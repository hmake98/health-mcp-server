# DB Models

MongoDB via Mongoose. All models use `{ timestamps: true }` (adds `createdAt`, `updatedAt`).

## Vital

Collection: `vitals`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | String | Yes | indexed |
| `type` | String (enum) | Yes | see values below |
| `value` | Number | Yes | |
| `unit` | String | Yes | e.g. `"bpm"`, `"ms"`, `"%"` |
| `startDate` | Date | Yes | indexed |
| `endDate` | Date | Yes | |
| `source` | String | No | default `"Apple Health"` |

Enum values for `type`: `heart_rate` · `resting_heart_rate` · `hrv` · `blood_oxygen` · `blood_pressure_systolic` · `blood_pressure_diastolic`

Indexes: `(userId, type, startDate DESC)` compound · `userId` · `type` · `startDate`

---

## Sleep

Collection: `sleeps`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | String | Yes | indexed |
| `stage` | String (enum) | Yes | |
| `startDate` | Date | Yes | indexed |
| `endDate` | Date | Yes | |
| `durationSeconds` | Number | Yes | |
| `source` | String | No | default `"Apple Health"` |

Enum values for `stage`: `inBed` · `asleepUnspecified` · `awake` · `asleepDeep` · `asleepCore` · `asleepREM`

Index: `(userId, startDate DESC)`

---

## Workout

Collection: `workouts`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | String | Yes | indexed |
| `workoutType` | String | Yes | e.g. `"Running"`, `"Cycling"` |
| `startDate` | Date | Yes | indexed |
| `endDate` | Date | Yes | |
| `durationSeconds` | Number | Yes | |
| `totalEnergyBurnedKcal` | Number | No | default `0` |
| `totalDistanceMeters` | Number | No | default `0` |
| `averageHeartRate` | Number | No | optional |
| `source` | String | No | default `"Apple Health"` |

Index: `(userId, startDate DESC)`

---

## Activity

Collection: `activities`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | String | Yes | indexed |
| `date` | Date | Yes | indexed |
| `stepCount` | Number | No | default `0` |
| `distanceMeters` | Number | No | default `0` |
| `activeEnergyKcal` | Number | No | default `0` |
| `exerciseMinutes` | Number | No | default `0` |
| `flightsClimbed` | Number | No | default `0` |
| `source` | String | No | default `"Apple Health"` |

**Unique index**: `(userId, date)` — one record per user per day; writes use `upsert`.
