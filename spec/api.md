# REST API

Base: `http://localhost:$PORT`

---

## Auth routes — no key required

### POST /auth/register

Create a new user. Returns the API key to use for all `/api/health/*` requests.

**Body**
```json
{ "name": "Harsh", "email": "you@example.com", "password": "min8chars" }
```

**Response** `201`
```json
{ "id": "<userId>", "name": "Harsh", "email": "you@example.com", "apiKey": "<hex>" }
```

**Errors** `400` invalid body · `409` email already registered

---

### POST /auth/login

Sign in with email and password. Returns the same API key stored for the account.

**Body**
```json
{ "email": "you@example.com", "password": "yourpassword" }
```

**Response** `200`
```json
{ "id": "<userId>", "name": "Harsh", "email": "you@example.com", "apiKey": "<hex>" }
```

**Errors** `400` invalid body · `401` wrong credentials or inactive account

---

## Health routes — API key required

All `/api/health/*` routes require:
```
x-api-key: <apiKey from register or login>
```
Returns `401` if missing, wrong, or the account is inactive.  
The `userId` stored on every health record is derived from the authenticated API key — it is not accepted in the request body.

---

### POST /api/health/vitals

Bulk-insert vital sign records. Duplicate documents are silently skipped (`ordered: false`).

**Body**
```json
{
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

### POST /api/health/sleep

Bulk-insert sleep stage records. Duplicate documents are silently skipped.

**Body**
```json
{
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

### POST /api/health/workouts

Bulk-insert workout records. Duplicate documents are silently skipped.

**Body**
```json
{
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

### POST /api/health/activity

Upsert daily activity records by `(userId, date)`.

**Body**
```json
{
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

### GET /health

Liveness check. No auth required.

**Response** `{ "ok": true }`
