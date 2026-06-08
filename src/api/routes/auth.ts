import { Router, Request, Response } from "express";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { z } from "zod";
import { User } from "../../db/models/User.js";

export const authRouter = Router();

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, stored: string): boolean {
  const colonIdx = stored.indexOf(":");
  const salt = stored.slice(0, colonIdx);
  const hash = stored.slice(colonIdx + 1);
  const input = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(input, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// HMAC-signs a random nonce with API_SECRET so keys can't be forged without the secret.
function generateApiKey(): string {
  const nonce = randomBytes(16).toString("hex");
  return createHmac("sha256", process.env.API_SECRET!)
    .update(nonce)
    .digest("hex");
}

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { name, email, password } = parsed.data;

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${hashPassword(password, salt)}`;
  const apiKey = generateApiKey();

  const user = await User.create({ name, email, passwordHash, apiKey });

  res.status(201).json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    apiKey,
  });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, password } = parsed.data;

  const user = await User.findOne({ email }).lean();
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    apiKey: user.apiKey,
  });
});
