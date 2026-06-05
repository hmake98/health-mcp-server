import { timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";

export function apiAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-api-key"];
  const secret = process.env.API_SECRET!;

  // Use timing-safe comparison to prevent brute-force via response time
  if (
    !token ||
    typeof token !== "string" ||
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
