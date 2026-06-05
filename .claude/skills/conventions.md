---
description: Project coding conventions for health-mcp-server. Reference this before writing any new code to ensure consistency with the existing codebase.
---

# conventions

Reference this skill before writing new code in this project.

## File structure rules

- One Mongoose model per file in `src/db/models/`
- One MCP tool function per file in `src/mcp/tools/`
- All REST routes in one file: `src/api/routes/health.ts`
- No barrel files / index re-exports

## TypeScript

- `strict: true` — no implicit any, no implicit returns
- Module system: `Node16` with `.js` extensions on all local imports (even though source is `.ts`)
- Never use `any`. Use `unknown` + type guards or proper generics instead.
- Mongoose: always `.lean()` on read queries (returns plain objects, not Documents)
- Zod: use `.safeParse()`, never `.parse()` — handle errors explicitly

## MongoDB / Mongoose

- All schemas: `{ timestamps: true }`
- All schemas: `userId` field is required, indexed
- All schemas: `source` field defaults to `"Apple Health"`
- Date fields: always `Date` type, convert from ISO string at insert time
- Indexes: compound `(userId, <primary sort field> DESC)` on every model
- Activity: unique index `(userId, date)` — use `bulkWrite` upsert, not insertMany
- All others: use `insertMany(docs, { ordered: false }).catch(() => {})` — silent dedup

## REST API

- Route prefix: `/api/health/<resource>`
- Auth: `x-api-key` header middleware applied at router level — don't add per-route
- Validation: Zod schema named `<Resource>Payload`, always `safeParse` → 400 on fail
- Success response: `{ inserted: N }` or `{ upserted: N }` — nothing else
- Error response: `{ error: parsed.error.flatten() }` — Zod shape, not strings
- No authentication-related code in route handlers — that's auth.ts's job

## MCP tools

- Tool names: `get_<resource>` (snake_case, always prefixed `get_`)
- All tools accept optional `userId` (default: `DEFAULT_USER_ID` env var → `"default"`)
- Date filter pattern: accept `from`, `to` (ISO strings), `days` (number, default 7)
- Return structure: `{ summary, records }` for lists, `{ byDate, raw, range }` for time-grouped
- `connectDB()` is called inside the CallToolRequestSchema handler — not at module top-level

## General

- No comments unless the WHY is non-obvious
- No docstrings or JSDoc
- Named exports only — no default exports
- Error handling: let errors bubble to the top-level `.catch()` in main() — no silent swallowing except DB dedup
