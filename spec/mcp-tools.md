# MCP Tools

Server name: `health-mcp` v1.0.0  
Transport: stdio  
All tools use `DEFAULT_USER_ID` env var automatically — no userId param needed.

---

## get_health_coaching_snapshot ⭐ primary coaching tool

Call this **first** for any question about exercise readiness, recovery, sleep quality, fatigue, or general health status. Returns a computed readiness score (0–100) anchored to the user's own 30-day baselines — not population norms.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `date` | ISO 8601 date | No | today |

**Returns**
```json
{
  "date": "YYYY-MM-DD",
  "readiness": {
    "score": 74,
    "outOf": 100,
    "label": "Good — quality training session appropriate",
    "exerciseRecommendation": "...",
    "signals": ["HRV 58 ms — above baseline (52 ms): good recovery", "..."]
  },
  "recovery": {
    "hrv": { "current": 58, "baseline30dMean": 52, "trend": "above_baseline" },
    "restingHeartRate": { "current": 54, "baseline30dMean": 57, "trend": "below_baseline" },
    "walkingHeartRate": { "value": 72, "unit": "bpm" },
    "vo2Max": { "value": 47.2, "unit": "mL/min/kg", "fitnessLevel": "above average" },
    "bloodOxygen": { "value": 98, "unit": "%" },
    "heartRate": { "value": 68, "unit": "bpm" }
  },
  "sleepConsistency": {
    "avgBedtime": "11:00 PM",
    "bedtimeStdDevMinutes": 22,
    "consistencyRating": "good — mild variation"
  },
  "lastNightSleep": {
    "totalSleepHours": 7.2,
    "efficiencyPct": 88,
    "deepHours": 1.3,
    "remHours": 1.8,
    "vsBaseline30d": { "avgTotalSleepHours": 6.9, "deltaHours": 0.3 }
  },
  "trainingLoad": {
    "workoutsLast3Days": 1,
    "workoutsLast7Days": 3,
    "daysSinceLastWorkout": 1,
    "consecutiveTrainingDays": 0
  },
  "activityToday": { "steps": 4200, "activeKcal": 310 },
  "avg7dActivity": { "stepsPerDay": 8400 }
}
```

---

## get_latest_vitals

Most recent reading per vital type. Use `get_health_coaching_snapshot` for coaching questions — this is for point-in-time vital lookups.

**Returns** `{ heart_rate, resting_heart_rate, hrv, blood_oxygen, blood_pressure, walking_heart_rate_average, vo2_max }` — each with value, unit, status, normalRange.

---

## get_vitals

Vital history with optional type and date filters.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `type` | `heart_rate` \| `resting_heart_rate` \| `hrv` \| `blood_oxygen` \| `blood_pressure_systolic` \| `blood_pressure_diastolic` \| `respiratory_rate` \| `walking_heart_rate_average` \| `vo2_max` | No | all |
| `from` | ISO 8601 | No | — |
| `to` | ISO 8601 | No | — |
| `limit` | number | No | 100 |

**Returns** Array of Vital docs sorted by `startDate DESC`.

---

## get_sleep_summary

Sleep data grouped by night with stage breakdown. Use `get_health_coaching_snapshot` for coaching questions — this is for multi-night logs or stage history.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `from` | ISO 8601 | No | `now - days` |
| `to` | ISO 8601 | No | now |
| `days` | number | No | 7 |

**Returns** `{ range, summary: { avgTotalSleepHours, avgDeepHours, avgREMHours, avgSleepEfficiencyPct }, nights: [...] }`  
Each night's `date` is the **evening the session began** (e.g. `2026-06-09` = evening Jun 9 → morning Jun 10).

---

## get_workouts

Workout history with aggregate summary.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `workoutType` | string | No | all (case-insensitive regex) |
| `from` | ISO 8601 | No | — |
| `to` | ISO 8601 | No | — |
| `limit` | number | No | 50 |

**Returns** `{ summary: { totalWorkouts, totalKcal, totalDistanceKm, byType }, workouts: [...] }`

---

## get_activity

Daily activity with totals and per-day averages. Use `get_health_coaching_snapshot` for coaching — it already includes 7-day averages.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `from` | ISO 8601 | No | `now - days` |
| `to` | ISO 8601 | No | now |
| `days` | number | No | 7 |

**Returns** `{ range, summary, averages, dailyLog: [...] }`
