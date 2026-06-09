# DB Models

MongoDB via Mongoose. All models use `{ timestamps: true }` (adds `createdAt`, `updatedAt`).

## User

Collection: `users`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | String | Yes | trimmed |
| `email` | String | Yes | unique, lowercased |
| `passwordHash` | String | Yes | `salt:scrypt64` format |
| `apiKey` | String | Yes | unique, HMAC-SHA256 signed with `API_SECRET` |
| `active` | Boolean | No | default `true`; set `false` to revoke access |

Indexes: `email` (unique) · `apiKey` (unique, used for every ingest auth lookup)

---

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

---

## OAuthClient

Collection: `oauthclients`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clientId` | String | Yes | unique, 32-char hex |
| `clientSecret` | String | No | null for public clients |
| `name` | String | Yes | display name shown on authorize page |
| `redirectUris` | String[] | Yes | allowed redirect URIs |
| `scopes` | String[] | No | default `["health:read"]` |

---

## OAuthCode

Collection: `oauthcodes`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `code` | String | Yes | unique, 64-char hex |
| `clientId` | String | Yes | |
| `userId` | String | Yes | |
| `redirectUri` | String | Yes | |
| `scope` | String | Yes | |
| `codeChallenge` | String | No | base64url(sha256(verifier)) |
| `codeChallengeMethod` | String | No | `S256` |
| `expiresAt` | Date | Yes | 10 min from creation |
| `used` | Boolean | No | default `false`; codes are single-use |

TTL index on `expiresAt` — MongoDB auto-deletes expired codes.

---

## OAuthToken

Collection: `oauthtokens`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `refreshToken` | String | Yes | unique, 64-char hex opaque token |
| `clientId` | String | Yes | |
| `userId` | String | Yes | |
| `scope` | String | Yes | |
| `expiresAt` | Date | Yes | 30 days from creation |
| `revoked` | Boolean | No | default `false` |

TTL index on `expiresAt` — MongoDB auto-deletes expired tokens.  
Access tokens are self-contained HS256 JWTs — not stored in MongoDB.
