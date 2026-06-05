Find and fix every TypeScript type error in the project.

Steps:
1. Run `npx tsc --noEmit 2>&1` and collect all errors
2. If zero errors → report "Type-clean ✓" and stop
3. Group errors by file. For each file:
   - Read the file
   - Understand each error in context
   - Apply the minimal correct fix — proper type annotations, type narrowing, or fixing the actual logic
   - Rules: never use `any`, `as any`, or `@ts-ignore`; never widen a type to silence an error; fix the real problem
4. After fixing all files, run `npx tsc --noEmit` again
5. If errors remain, repeat until clean
6. Report: how many errors fixed, in which files, and what the fixes were

Prefer fixing types over changing logic. If a type error reveals a real bug, flag it before fixing.
