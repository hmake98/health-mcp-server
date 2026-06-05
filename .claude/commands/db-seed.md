Seed MongoDB with realistic test data for userId "test". Arguments: $ARGUMENTS

If $ARGUMENTS specifies a collection name, seed only that one. Otherwise seed all four.

Steps:
1. Read MONGODB_URI from .env using `source .env`
2. Write a seed script to `scripts/_seed.ts` (temp file) that:
   - Connects to MongoDB via mongoose
   - Seeds these collections for userId "test":
     - **vitals**: 20 records over last 14 days — mix of heart_rate (60–95 bpm), resting_heart_rate (48–65), hrv (25–80 ms), blood_oxygen (95–99%)
     - **sleeps**: 7 nights — each with inBed, asleepCore, asleepDeep, asleepREM, awake stages; total 6–8h per night
     - **workouts**: 6 workouts — Running and Cycling mix, 20–75 min, realistic kcal and distance
     - **activity**: 14 days — steps 4000–14000, proportional distance, calories, exercise minutes
   - Uses insertMany with ordered: false (safe to run multiple times)
   - Logs count of inserted docs per collection
   - Disconnects cleanly
3. Run: `npx tsx scripts/_seed.ts`
4. Delete `scripts/_seed.ts` after it finishes
5. Report inserted counts per collection

Use Date.now() arithmetic for date offsets so dates are always relative to today.
