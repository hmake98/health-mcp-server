---
description: Scaffold a complete health data feature — Mongoose model + REST route + MCP tool — from a single description. Use when the user asks to add a new data type, metric, or health domain.
---

# scaffold-feature

Use this skill when: user wants to add a new health metric or data type (e.g. "add blood glucose tracking", "add step goals", "add medication logs").

This skill wires the full vertical slice so nothing is left half-done.

## What it creates

1. **`src/db/models/<Name>.ts`** — Mongoose model
   - Interface extending Document
   - Schema with userId index, startDate index, { timestamps: true }
   - Compound index `(userId, startDate DESC)` minimum
   - Default `source: "Apple Health"`

2. **`src/api/routes/health.ts`** — POST ingestion endpoint
   - Zod schema: `<Name>Payload` with userId + records array
   - Insert strategy: `insertMany(ordered:false)` for time-series; `bulkWrite` upsert for daily aggregates
   - Error response: `{ error: parsed.error.flatten() }` on 400
   - Success response: `{ inserted: N }` or `{ upserted: N }`

3. **`src/mcp/tools/<name>.ts`** — MCP query function
   - Export one async function with `{ userId, from?, to?, limit? }` signature
   - `.lean()` on all queries
   - Return `{ summary, records }` or `{ byDate, raw }` depending on type

4. **`src/mcp/server.ts`** — Tool registration
   - Add import
   - Add tool definition in ListToolsRequestSchema handler
   - Add `case` in CallToolRequestSchema switch

5. **`spec/models.md`**, **`spec/api.md`**, **`spec/mcp-tools.md`** — Spec updates

## Steps

1. Confirm the feature name and infer fields. If ambiguous, ask ONE question.
2. Create all 4 source files following patterns from existing models (Activity.ts, Vitals.ts).
3. Update all 3 spec files.
4. Run `npx tsc --noEmit` — fix any errors before reporting done.
5. Report a summary: files created, route path, MCP tool name.

## Conventions to follow

- Model file: PascalCase (`BloodGlucose.ts`)
- Tool file: snake_case (`blood_glucose.ts`)
- Route: `/api/health/<kebab-case>`
- MCP tool name: `get_<snake_case>`
- Never use `any`. Never skip the compound index.
