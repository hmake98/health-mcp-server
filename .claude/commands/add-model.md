Create a new Mongoose model for: $ARGUMENTS

Steps:
1. Infer the model name and fields from $ARGUMENTS. If ambiguous, ask once.
2. Create `src/db/models/<ModelName>.ts` — follow the exact pattern of existing models:
   - TypeScript interface extending Document
   - Schema with required flags, indexes, { timestamps: true }
   - Sensible defaults and compound index where applicable
   - Named export: `export const <Model> = model<I<Model>>("<Model>", <Model>Schema)`
3. Update `spec/models.md` — add a new ## section with the field table and index notes, matching the existing format exactly.
4. Tell me: does any existing route or MCP tool need to import this model? If yes, show what to add.

Match the coding style of Vitals.ts / Activity.ts precisely — no extra comments, same import order.
