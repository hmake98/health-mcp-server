# health-mcp-server

Apple Health → MongoDB → MCP. Ingests health data from iOS via REST and exposes it to AI assistants over the Model Context Protocol.

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Express API with hot reload (tsx watch, port 3000) |
| `npm run mcp` | MCP server on stdio (for Claude Desktop / AI clients) |
| `npm run build` | `tsc` → `dist/` |
| `npm start` | Run compiled `dist/index.js` |

## Env vars

| Var | Required | Default |
|-----|----------|---------|
| `MONGODB_URI` | Yes | — |
| `API_SECRET` | Yes | — (x-api-key header value) |
| `PORT` | No | `3000` |
| `DEFAULT_USER_ID` | No | `"default"` |

## Architecture

```
iOS / Shortcut
   │  POST /api/health/{vitals,sleep,workouts,activity}
   │  x-api-key: $API_SECRET
   ▼
Express REST API  ──►  MongoDB (Mongoose)
                              │
                              ▼
                    MCP stdio Server
                    Claude / AI client
```

Two processes share the same DB:
- **API server** (`src/index.ts`) — ingest path
- **MCP server** (`src/mcp/server.ts`) — read-only query path

Auth is header-only (`x-api-key`). No JWT. No sessions.  
Activity is upserted by `(userId, date)`; all other collections append.

## Source layout

<!-- FILE_TREE_START -->
  src/api/index.ts
  src/api/middleware/auth.ts
  src/api/routes/auth.ts
  src/api/routes/health.ts
  src/db/connection.ts
  src/db/models/Activity.ts
  src/db/models/Sleep.ts
  src/db/models/User.ts
  src/db/models/Vitals.ts
  src/db/models/Workout.ts
  src/index.ts
  src/mcp/create-server.ts
  src/mcp/server.ts
  src/mcp/tools/activity.ts
  src/mcp/tools/sleep.ts
  src/mcp/tools/vitals.ts
  src/mcp/tools/workouts.ts
<!-- FILE_TREE_END -->

## Spec files (update when adding routes / tools / models)

- [spec/models.md](spec/models.md) — Mongoose schemas, fields, indexes
- [spec/api.md](spec/api.md) — REST endpoints, payloads, auth
- [spec/mcp-tools.md](spec/mcp-tools.md) — MCP tool names, params, defaults

## Maintenance rule

Run `bash scripts/update-claude.sh` (or it runs automatically on session stop) to refresh the file tree above.  
When adding an API route → update `spec/api.md`.  
When adding an MCP tool → update `spec/mcp-tools.md`.  
When adding a model → update `spec/models.md`.
