#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./create-server.js";

async function main() {
  const transport = new StdioServerTransport();
  const server = createMcpServer();
  await server.connect(transport);
  console.error("Health MCP server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
