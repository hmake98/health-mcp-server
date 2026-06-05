Inspect the MongoDB database. Arguments: $ARGUMENTS

Supported argument forms:
- `<collection>` — show 5 most recent records for userId "default"
- `<collection> <userId>` — use specified userId
- (no args) — show document counts for all 4 collections

Steps:
1. Source .env to get MONGODB_URI
2. Write a short inline script to `scripts/_inspect.ts`, run it with `npx tsx`, then delete it
3. Format output clearly:
   - For counts: a table with collection name + count
   - For records: pretty-printed JSON, most recent first
4. If a collection is empty, say so explicitly

Collections: vitals, sleeps, workouts, activities
