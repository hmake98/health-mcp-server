Show the MCP server configuration to register this server with Claude Desktop or any MCP client.

Steps:
1. Get the absolute project path: `pwd`
2. Read MONGODB_URI from .env — show only the first 30 chars + "…" for safety
3. Print the JSON block to add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "health": {
      "command": "npx",
      "args": ["tsx", "<absolute-path>/src/mcp/server.ts"],
      "env": {
        "MONGODB_URI": "<value from .env>",
        "DEFAULT_USER_ID": "default"
      }
    }
  }
}
```

4. Remind me:
   - Merge into the existing mcpServers object if it already exists
   - Restart Claude Desktop after saving
   - Test the connection by asking Claude: "What are my latest vitals?"

5. Also show the manual test command: `npm run mcp`
