import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const colonIdx = stored.indexOf(":");
  const salt = stored.slice(0, colonIdx);
  const hash = stored.slice(colonIdx + 1);
  const input = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(input, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
