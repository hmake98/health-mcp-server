Run a full system health check and print a status table. Do not fix anything unless I ask.

Check each item:

1. **TypeScript** — `npx tsc --noEmit 2>&1`
   - ✓ clean, or show error count + first 5 lines

2. **API server** — `curl -s http://localhost:3000/health`
   - ✓ running on :3000, or ✗ not responding

3. **Env vars** — confirm .env exists and has non-empty MONGODB_URI and API_SECRET
   - Do NOT print the values, just ✓ / ✗ per key

4. **Dependencies** — `npm ls --depth=0 2>&1 | grep -E "UNMET|missing|invalid"`
   - ✓ ok, or list issues

5. **Git state** — `git status --short` + `git log -1 --format="%h %s"`
   - Show branch, dirty file count, last commit

Print a clean table: `Item | Status | Note`. One line per check.
