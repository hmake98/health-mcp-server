Add a new MCP tool for: $ARGUMENTS

Steps:
1. Infer the tool name (snake_case, prefixed get_) and query logic from $ARGUMENTS. Ask if unclear.
2. Create `src/mcp/tools/<name>.ts`:
   - Export one async function that accepts `{ userId, ...filters }`
   - Query the relevant Mongoose model(s) with .lean()
   - Return a structured object (totals + records, or byDate + raw, following existing patterns)
3. Register in `src/mcp/server.ts`:
   - Add import at the top
   - Add tool definition object in the ListToolsRequestSchema handler (name, description, inputSchema)
   - Add `case "tool_name":` in the CallToolRequestSchema switch, mapping args to the function
4. Update `spec/mcp-tools.md` — add a new ## section with param table, defaults, and return shape.
5. Run `npx tsc --noEmit` to confirm no type errors.

Follow existing tool patterns exactly: userId defaults to DEFAULT_USER, optional date filters via from/to/days, always .lean() on queries.
