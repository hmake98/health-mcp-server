---
description: Review staged or recent changes in this project against its conventions, API contracts, and type safety before committing. Use before git commit or when asked to review changes.
---

# review

Use this skill proactively before committing, or when the user asks to review changes.

## Checklist

Run through each item. Report failures only — skip passing items.

### 1. Type safety
```
npx tsc --noEmit
```
Zero tolerance. Block commit if there are errors.

### 2. Convention compliance (per `conventions` skill)
- New models: has userId index? compound index? timestamps? source default?
- New routes: Zod safeParse? correct error shape? correct success shape? no auth logic in handler?
- New MCP tools: uses `.lean()`? userId defaults correctly? return shape matches convention?
- Imports: `.js` extension on all local imports?

### 3. Spec files updated
- New model → `spec/models.md` updated?
- New route → `spec/api.md` updated?
- New MCP tool → `spec/mcp-tools.md` updated?

### 4. No accidental changes
- `.env` not staged? (`git status` check)
- `dist/` not staged?
- `node_modules/` not staged?
- `scripts/_tmp_*.ts` temp files not staged or deleted?

### 5. Diff sanity
- `git diff --staged` — does the diff match the stated intent?
- No leftover debug logs, console.log calls, TODO comments?

## Output format

```
✓ Type-clean
✗ spec/api.md not updated for new /api/health/glucose route
✗ WorkoutSchema missing compound index
✓ No env/dist files staged
```

Fix issues, then re-run the checklist. Only approve commit when all items pass.
