# MCP Tools

Server name: `health-mcp` v1.0.0  
Transport: stdio  
All tools accept optional `userId` (defaults to `DEFAULT_USER_ID` env var, fallback `"default"`).

---

## get_latest_vitals

Most recent reading per vital type (heart_rate, resting_heart_rate, hrv, blood_oxygen).

| Param | Type | Required |
|-------|------|----------|
| `userId` | string | No |

**Returns** `{ heart_rate, resting_heart_rate, hrv, blood_oxygen }` — each is the latest Vital doc or `null`.

---

## get_vitals

Vital history with optional type and date filters.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `userId` | string | No | DEFAULT_USER_ID |
| `type` | enum (see models.md) | No | all types |
| `from` | ISO 8601 | No | — |
| `to` | ISO 8601 | No | — |
| `limit` | number | No | 100 |

**Returns** Array of Vital docs sorted by `startDate DESC`.

---

## get_sleep_summary

Sleep data grouped by calendar date with stage breakdown.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `userId` | string | No | DEFAULT_USER_ID |
| `from` | ISO 8601 | No | `now - days` |
| `to` | ISO 8601 | No | now |
| `days` | number | No | 7 |

**Returns**
```json
{
  "range": { "from": "...", "to": "..." },
  "byDate": {
    "YYYY-MM-DD": {
      "totalSeconds": 28800,
      "stages": { "asleepDeep": 3600, "asleepREM": 5400, "..." : 0 }
    }
  },
  "raw": [ ...Sleep docs ]
}
```

---

## get_workouts

Workout history with aggregate summary.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `userId` | string | No | DEFAULT_USER_ID |
| `workoutType` | string | No | all (case-insensitive regex) |
| `from` | ISO 8601 | No | — |
| `to` | ISO 8601 | No | — |
| `limit` | number | No | 50 |

**Returns**
```json
{
  "summary": {
    "totalWorkouts": 10,
    "totalKcal": 2500,
    "totalDistanceKm": 50.2,
    "byType": { "Running": 7, "Cycling": 3 }
  },
  "records": [ ...Workout docs ]
}
```

---

## get_activity

Daily activity with totals and per-day averages.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `userId` | string | No | DEFAULT_USER_ID |
| `from` | ISO 8601 | No | `now - days` |
| `to` | ISO 8601 | No | now |
| `days` | number | No | 7 |

**Returns**
```json
{
  "totals": { "steps": 56000, "distanceKm": 42.0, "activeKcal": 2800, "exerciseMinutes": 315 },
  "averages": { "stepsPerDay": 8000, "activeKcalPerDay": 400, "exerciseMinutesPerDay": 45 },
  "records": [ ...Activity docs ]
}
```
