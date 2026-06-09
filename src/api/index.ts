import express, { Request, Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { apiAuth } from "./middleware/auth.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { oauthRouter, oauthMetadata } from "./routes/oauth.js";
import { createMcpServer } from "../mcp/create-server.js";

const ingestLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
});

const authLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
});

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ ok: ready });
  });

  app.get("/.well-known/oauth-authorization-server", (req, res) => {
    res.json(oauthMetadata(req));
  });

  app.use("/auth", authLimit, authRouter);
  app.use("/oauth", authLimit, oauthRouter);
  app.use("/api/health", apiAuth, ingestLimit, healthRouter);

  app.all("/mcp", apiAuth, async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    res.on("close", () => {
      transport.close().catch(console.error);
      server.close().catch(console.error);
    });
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}
