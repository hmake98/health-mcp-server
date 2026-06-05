Create a git commit for current changes. Arguments: $ARGUMENTS (optional hint for the message)

Steps:
1. `git status` + `git diff` — understand what changed
2. Stage modified tracked files: `git add -u`
   - Never add: .env, dist/, node_modules/, *.log
   - Stage new untracked src/ files if relevant: `git add src/`
3. Draft a commit message:
   - Imperative mood, ≤72 chars first line
   - If $ARGUMENTS is provided, use it as a hint for the message focus
   - If multiple concerns changed, list them in the body
4. Show me the staged files + message draft — wait for approval
5. On approval (or if I said "just do it"): `git commit -m "..."`

Never --no-verify. Never amend without being asked.
