import { createHmac } from "crypto";

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function encodeStr(s: string): string {
  return base64url(Buffer.from(s, "utf8"));
}

export function signJwt(payload: object, secret: string, expiresInSecs: number): string {
  const header = encodeStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = encodeStr(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSecs }));
  const sig = base64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = base64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
