# REST API

Base: `http://localhost:$PORT`

## Auth

All `/api/health/*` routes require:
```
x-api-key: $API_SECRET
```
Returns `401` if missing or wrong.

---

## POST /api/health/vitals

Bulk-insert vital sign records. Duplicate documents are silently skipped (`ordered: false`).

**Body**
```json
{
  "userId": "string",
  "records": [
    {
      "type": "heart_rate | resting_heart_rate | hrv | blood_oxygen | blood_pressure_systolic | blood_pressure_diastolic",
      "value": 72,
      "unit": "bpm",
      "startDate": "ISO 8601",
      "endDate": "ISO 8601",
      "source": "optional string"
    }
  ]
}
```

**Response** `{ "inserted": N }`

---

## POST /api/health/sleep

Bulk-insert sleep stage records. Duplicate documents are silently skipped.

**Body**
```json
{
  "userId": "string",
  "records": [
    {
      "stage": "inBed | asleepUnspecified | awake | asleepDeep | asleepCore | asleepREM",
      "startDate": "ISO 8601",
      "endDate": "ISO 8601",
      "durationSeconds": 3600,
      "source": "optional string"
    }
  ]
}
```

**Response** `{ "inserted": N }`

---

## POST /api/health/workouts

Bulk-insert workout records. Duplicate documents are silently skipped.

**Body**
```json
{
  "userId": "string",
  "records": [
    {
      "workoutType": "Running",
      "startDate": "ISO 8601",
      "endDate": "ISO 8601",
      "durationSeconds": 1800,
      "totalEnergyBurnedKcal": 250,
      "totalDistanceMeters": 5000,
      "averageHeartRate": 145,
      "source": "optional string"
    }
  ]
}
```

**Response** `{ "inserted": N }`

---

## POST /api/health/activity

Upsert daily activity records by `(userId, date)`.

**Body**
```json
{
  "userId": "string",
  "records": [
    {
      "date": "ISO 8601",
      "stepCount": 8000,
      "distanceMeters": 6000,
      "activeEnergyKcal": 400,
      "exerciseMinutes": 45,
      "flightsClimbed": 5,
      "source": "optional string"
    }
  ]
}
```

**Response** `{ "upserted": N }`

---

## GET /health

Liveness check. No auth required.

**Response** `{ "ok": true }`
