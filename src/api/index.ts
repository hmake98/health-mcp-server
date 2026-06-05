import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { apiAuth } from "./middleware/auth.js";
import { healthRouter } from "./routes/health.js";

const ingestLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
});

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    if (!ready) {
      res.status(503).json({ ok: false, db: "disconnected" });
      return;
    }
    res.json({ ok: true, db: "connected" });
  });

  app.use("/api/health", apiAuth, ingestLimit, healthRouter);
  return app;
}
