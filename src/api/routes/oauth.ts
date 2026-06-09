import { Router, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { User } from "../../db/models/User.js";
import { OAuthClient } from "../../db/models/OAuthClient.js";
import { OAuthCode } from "../../db/models/OAuthCode.js";
import { OAuthToken } from "../../db/models/OAuthToken.js";
import { signJwt } from "../lib/jwt.js";
import { verifyPassword } from "../lib/password.js";

export const oauthRouter = Router();

const DEFAULT_SCOPE = "health:read";
const ACCESS_TOKEN_TTL = 3600; // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getBaseUrl(req: Request): string {
  return process.env.BASE_URL ?? `${req.protocol}://${req.get("host")}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function verifyPkce(verifier: string, storedChallenge: string): boolean {
  return base64url(createHash("sha256").update(verifier).digest()) === storedChallenge;
}

// ── Dynamic Client Registration (RFC 7591) ─────────────────────────────────
const RegisterClientSchema = z.object({
  client_name: z.string().min(1).max(100),
  redirect_uris: z.array(z.string().url()).min(1),
  scope: z.string().optional(),
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

oauthRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_client_metadata", error_description: "client_name and redirect_uris are required" });
    return;
  }

  const { client_name, redirect_uris, scope, token_endpoint_auth_method } = parsed.data;
  const isPublic = token_endpoint_auth_method === "none";

  const clientId = randomBytes(16).toString("hex");
  const clientSecret = isPublic ? null : randomBytes(32).toString("hex");

  await OAuthClient.create({
    clientId,
    clientSecret,
    name: client_name,
    redirectUris: redirect_uris,
    scopes: scope ? scope.split(" ") : [DEFAULT_SCOPE],
  });

  const body: Record<string, unknown> = {
    client_id: clientId,
    client_name,
    redirect_uris,
    scope: scope ?? DEFAULT_SCOPE,
    token_endpoint_auth_method: isPublic ? "none" : "client_secret_post",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
  if (clientSecret) body.client_secret = clientSecret;

  res.status(201).json(body);
});

// ── Authorization endpoint ──────────────────────────────────────────────────
function authorizeHtml(params: {
  clientName: string;
  scope: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  error?: string;
}): string {
  const { clientName, scope, clientId, redirectUri, state, codeChallenge, codeChallengeMethod, error } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize — Health MCP</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f7; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.08); padding: 40px; width: 100%; max-width: 400px; }
    .icon { width: 48px; height: 48px; background: #0066ff; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
    .icon svg { fill: #fff; width: 24px; height: 24px; }
    h1 { font-size: 20px; font-weight: 600; text-align: center; margin-bottom: 6px; }
    .subtitle { font-size: 14px; color: #666; text-align: center; margin-bottom: 24px; }
    .scope-box { background: #f0f4ff; border: 1px solid #d0ddff; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #334; }
    .scope-box strong { display: block; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #888; }
    label { display: block; font-size: 13px; font-weight: 500; color: #333; margin-bottom: 6px; }
    input[type=email], input[type=password] { display: block; width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; outline: none; transition: border-color .15s; margin-bottom: 16px; }
    input:focus { border-color: #0066ff; }
    .error { background: #fff0f0; border: 1px solid #fcc; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #c00; margin-bottom: 16px; }
    button { width: 100%; padding: 12px; background: #0066ff; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer; transition: background .15s; }
    button:hover { background: #0052cc; }
    .deny { display: block; text-align: center; margin-top: 14px; font-size: 13px; color: #888; text-decoration: none; }
    .deny:hover { color: #333; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
    </div>
    <h1>Authorize Access</h1>
    <p class="subtitle"><strong>${esc(clientName)}</strong> is requesting access to your health data.</p>
    <div class="scope-box">
      <strong>Permissions requested</strong>
      ${esc(scope)}
    </div>
    ${error ? `<div class="error">Invalid email or password. Please try again.</div>` : ""}
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${esc(clientId)}">
      <input type="hidden" name="redirect_uri" value="${esc(redirectUri)}">
      <input type="hidden" name="state" value="${esc(state)}">
      <input type="hidden" name="scope" value="${esc(scope)}">
      <input type="hidden" name="code_challenge" value="${esc(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${esc(codeChallengeMethod)}">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required autofocus autocomplete="email">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password">
      <button type="submit">Allow Access</button>
    </form>
    <a class="deny" href="${esc(redirectUri)}?error=access_denied&state=${esc(state)}">Deny</a>
  </div>
</body>
</html>`;
}

oauthRouter.get("/authorize", async (req: Request, res: Response) => {
  const { client_id, redirect_uri, state = "", code_challenge = "", code_challenge_method = "", scope = DEFAULT_SCOPE, response_type } = req.query as Record<string, string>;

  if (response_type !== "code") {
    res.status(400).send("unsupported_response_type");
    return;
  }

  const client = await OAuthClient.findOne({ clientId: client_id });
  if (!client) {
    res.status(400).send("Unknown client_id");
    return;
  }
  if (!client.redirectUris.includes(redirect_uri)) {
    res.status(400).send("redirect_uri not registered for this client");
    return;
  }

  res.send(authorizeHtml({ clientName: client.name, scope, clientId: client_id, redirectUri: redirect_uri, state, codeChallenge: code_challenge, codeChallengeMethod: code_challenge_method }));
});

oauthRouter.post("/authorize", async (req: Request, res: Response) => {
  const { client_id, redirect_uri, state = "", scope = DEFAULT_SCOPE, code_challenge = "", code_challenge_method = "", email, password } = req.body as Record<string, string>;

  const client = await OAuthClient.findOne({ clientId: client_id });
  if (!client || !client.redirectUris.includes(redirect_uri)) {
    res.status(400).send("Invalid client or redirect_uri");
    return;
  }

  const user = await User.findOne({ email: email?.toLowerCase(), active: true });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.send(authorizeHtml({ clientName: client.name, scope, clientId: client_id, redirectUri: redirect_uri, state, codeChallenge: code_challenge, codeChallengeMethod: code_challenge_method, error: "invalid_credentials" }));
    return;
  }

  const code = randomBytes(32).toString("hex");
  await OAuthCode.create({
    code,
    clientId: client_id,
    userId: user._id.toString(),
    redirectUri: redirect_uri,
    scope,
    codeChallenge: code_challenge || null,
    codeChallengeMethod: code_challenge_method || null,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const params = new URLSearchParams({ code, ...(state ? { state } : {}) });
  res.redirect(`${redirect_uri}?${params}`);
});

// ── Token endpoint ──────────────────────────────────────────────────────────
oauthRouter.post("/token", async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = body;
  const secret = process.env.API_SECRET!;

  if (grant_type === "authorization_code") {
    if (!code || !client_id || !redirect_uri) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }

    const authCode = await OAuthCode.findOne({ code, used: false });
    if (!authCode || authCode.expiresAt < new Date() || authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    const client = await OAuthClient.findOne({ clientId: client_id });
    if (!client) {
      res.status(401).json({ error: "invalid_client" });
      return;
    }
    if (client.clientSecret && client.clientSecret !== client_secret) {
      res.status(401).json({ error: "invalid_client" });
      return;
    }

    if (authCode.codeChallenge) {
      if (!code_verifier) {
        res.status(400).json({ error: "invalid_grant", error_description: "code_verifier required" });
        return;
      }
      if (!verifyPkce(code_verifier, authCode.codeChallenge)) {
        res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
        return;
      }
    }

    await OAuthCode.updateOne({ _id: authCode._id }, { used: true });

    const accessToken = signJwt({ sub: authCode.userId, client_id, scope: authCode.scope }, secret, ACCESS_TOKEN_TTL);
    const refreshTokenValue = randomBytes(32).toString("hex");
    await OAuthToken.create({
      refreshToken: refreshTokenValue,
      clientId: client_id,
      userId: authCode.userId,
      scope: authCode.scope,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    res.json({ access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL, refresh_token: refreshTokenValue, scope: authCode.scope });
    return;
  }

  if (grant_type === "refresh_token") {
    if (!refresh_token) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }

    const tokenDoc = await OAuthToken.findOne({ refreshToken: refresh_token, revoked: false });
    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    const accessToken = signJwt({ sub: tokenDoc.userId, client_id: tokenDoc.clientId, scope: tokenDoc.scope }, secret, ACCESS_TOKEN_TTL);
    res.json({ access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL, scope: tokenDoc.scope });
    return;
  }

  res.status(400).json({ error: "unsupported_grant_type" });
});

// ── Revocation endpoint (RFC 7009) ──────────────────────────────────────────
oauthRouter.post("/revoke", async (req: Request, res: Response) => {
  const { token } = req.body as Record<string, string>;
  if (token) {
    await OAuthToken.updateOne({ refreshToken: token }, { revoked: true });
  }
  res.status(200).json({});
});

// ── OAuth metadata (RFC 8414) — exported for use at /.well-known ────────────
export function oauthMetadata(req: Request) {
  const base = getBaseUrl(req);
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    scopes_supported: [DEFAULT_SCOPE],
  };
}
