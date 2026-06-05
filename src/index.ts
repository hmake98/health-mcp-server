import "dotenv/config";
import { connectDB, disconnectDB } from "./db/connection.js";
import { createApp } from "./api/index.js";

const REQUIRED_ENV = ["MONGODB_URI", "API_SECRET"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  await connectDB();
  const app = createApp();
  const server = app.listen(PORT, () =>
    console.log(`API listening on http://localhost:${PORT}`)
  );

  function shutdown(signal: string) {
    console.log(`${signal} received — shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
