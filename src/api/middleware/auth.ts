import { Request, Response, NextFunction } from "express";

export function apiAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-api-key"];
  if (!token || token !== process.env.API_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
