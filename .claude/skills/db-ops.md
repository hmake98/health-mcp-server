---
description: Database operations — seed test data, inspect collections, run ad-hoc queries. Use when working with MongoDB data in this project.
---

# db-ops

Use this skill when: seeding test data, inspecting what's in the DB, debugging data issues, or verifying inserts worked.

## Seed test data

Write a temp script to `scripts/_tmp_seed.ts`, run it, delete it.

Seed collections for userId `"test"` with realistic values:
- **vitals** (20 records, last 14 days): heart_rate 60–95, resting_heart_rate 48–65, hrv 25–80, blood_oxygen 95–99
- **sleeps** (7 nights): inBed + asleepCore + asleepDeep + asleepREM + awake per night, 6–8h total
- **workouts** (6 sessions): Running and Cycling mix, 20–75 min, proportional kcal and distance
- **activities** (14 days): steps 4000–14000, proportional distance, kcal, exerciseMinutes

Use `Date.now() - N * 86400000` for date offsets so data is always relative to today.
Use `insertMany({ ordered: false })` — safe to re-run.

## Inspect collections

Write a temp script to `scripts/_tmp_inspect.ts`, run it, delete it.

Default: show counts for all collections.
With collection arg: show 5 most recent records for userId `"default"`.

Collections map: `vitals`, `sleeps`, `workouts`, `activities`

## Ad-hoc query

When asked to run a specific query, write it as a minimal tsx script, run, delete.
Always `.lean()`, always limit results, always disconnect at the end.

## Script template

```typescript
import "dotenv/config";
import mongoose from "mongoose";
// ... import models
await mongoose.connect(process.env.MONGODB_URI!);
// ... do work
await mongoose.disconnect();
```

Always run with `npx tsx scripts/_tmp_<name>.ts` and delete the file immediately after.
Never leave temp scripts committed.
