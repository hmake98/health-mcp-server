import { Request, Response, NextFunction } from "express";
import { User } from "../../db/models/User.js";

declare module "express" {
  interface Request {
    user?: { id: string; email: string; name: string };
  }
}

export async function apiAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers["x-api-key"];
  if (!key || typeof key !== "string") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await User.findOne(
    { apiKey: key, active: true },
    { _id: 1, email: 1, name: 1 }
  ).lean();

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = { id: user._id.toString(), email: user.email, name: user.name };
  next();
}
