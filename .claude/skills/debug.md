---
description: Systematically debug issues in this Express/MongoDB/MCP stack. Use when something is broken, returning unexpected results, or failing silently.
---

# debug

Use this skill when: something isn't working — API returning errors, MCP tool returning wrong data, TypeScript errors, DB not connecting, or unexpected behavior.

## Diagnostic layers

Work through these in order, stopping when the root cause is found:

### 1. TypeScript errors
```
npx tsc --noEmit 2>&1
```
Fix before anything else. Type errors cause silent runtime failures in this codebase.

### 2. API layer
- Is the server running? `curl -s http://localhost:3000/health`
- Is the route registered? Check `src/api/index.ts` — route must be mounted under `/api/health`
- Is auth passing? All `/api/health/*` routes need `x-api-key: $API_SECRET`
- Is the Zod schema rejecting the payload? Test with a minimal body first

### 3. DB layer
- Is `MONGODB_URI` set in `.env`?
- Is `connectDB()` being awaited? In MCP server it's called per-request inside CallToolRequestSchema handler
- Is the model using the right collection? Mongoose pluralises — `Vital` → `vitals`, `Sleep` → `sleeps`
- Are indexes causing upsert conflicts? Activity uses unique `(userId, date)` — duplicates silently drop with `insertMany(ordered:false)`

### 4. MCP layer
- Tool not showing up? ListToolsRequestSchema handler must return it in the `tools` array
- Tool erroring? Check the switch case name matches the tool definition name exactly
- Wrong data? Verify the `userId` default — it falls back to `DEFAULT_USER_ID` env var, then `"default"`

### 5. Data issues
- Use `db-inspect` skill to check if records actually exist in DB
- Dates: all filters use `startDate` for vitals/sleep/workouts, `date` for activity
- Sleep summary groups by `startDate.toISOString().slice(0,10)` — timezone can shift dates

## Fix protocol

1. State the hypothesis clearly before making any change
2. Make one targeted fix at a time
3. Verify the fix actually resolves it before moving to the next issue
4. Run `npx tsc --noEmit` after every file edit
