Run TypeScript type checking across the whole project.

Run: `npx tsc --noEmit`

- If there are errors: show them clearly, grouped by file, and fix every one without being asked.
- If there are no errors: confirm "Project is type-clean ✓" and stop.

Do not introduce `any` casts to silence errors — fix the actual types.
