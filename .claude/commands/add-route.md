Add a new REST route to `src/api/routes/health.ts` for: $ARGUMENTS

Steps:
1. Infer the resource name, HTTP method (default POST), and fields from $ARGUMENTS. Ask if unclear.
2. Add to health.ts in the correct section:
   - A Zod schema named `<Resource>Payload` with userId + records array
   - The route handler using the existing pattern (safeParse → 400 on fail, insertMany or bulkWrite)
   - Use `insertMany(docs, { ordered: false }).catch(() => {})` for append-only
   - Use `bulkWrite` with upsert for resources with a unique key per user per day
3. Import the new model at the top if needed.
4. Update `spec/api.md` — add a new ## section with method, path, body shape, response shape.
5. Run `npx tsc --noEmit` to confirm no type errors.

Match the exact style of existing routes — same error shape `{ error: parsed.error.flatten() }`, same response `{ inserted: N }` or `{ upserted: N }`.
