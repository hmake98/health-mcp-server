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

---

## OAuth 2.0 — Authorization Code + PKCE

Enables Claude.ai, ChatGPT, and mobile MCP clients to authenticate without an API key.  
All OAuth routes are rate-limited. Access tokens are HS256 JWTs (1 h). Refresh tokens are 30-day opaque strings stored in MongoDB.

---

### GET /.well-known/oauth-authorization-server

OAuth metadata discovery (RFC 8414). No auth required.

**Response** `200`
```json
{
  "issuer": "https://your-server.com",
  "authorization_endpoint": "https://your-server.com/oauth/authorize",
  "token_endpoint": "https://your-server.com/oauth/token",
  "registration_endpoint": "https://your-server.com/oauth/register",
  "revocation_endpoint": "https://your-server.com/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
  "scopes_supported": ["health:read"]
}
```

---

### POST /oauth/register

Dynamic client registration (RFC 7591). Claude.ai and ChatGPT call this automatically.

**Body** `application/json`
```json
{
  "client_name": "Claude.ai",
  "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
  "scope": "health:read",
  "token_endpoint_auth_method": "none"
}
```

`token_endpoint_auth_method: "none"` → public client (no secret, PKCE required).  
Omit or use `"client_secret_post"` → confidential client (secret returned once).

**Response** `201`
```json
{
  "client_id": "<hex>",
  "client_secret": "<hex>",
  "client_name": "Claude.ai",
  "redirect_uris": ["..."],
  "scope": "health:read",
  "token_endpoint_auth_method": "client_secret_post",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"]
}
```

**Errors** `400` invalid_client_metadata

---

### GET /oauth/authorize

Displays a login page. The user approves access by entering their email and password.

**Query params**
| Param | Required | Notes |
|-------|----------|-------|
| `response_type` | Yes | must be `code` |
| `client_id` | Yes | |
| `redirect_uri` | Yes | must match registered URI |
| `state` | Recommended | CSRF protection, passed through unchanged |
| `code_challenge` | Recommended | base64url(sha256(code_verifier)) |
| `code_challenge_method` | Recommended | `S256` |
| `scope` | No | default `health:read` |

**Response** `200` HTML login form

**Errors** `400` unknown client · redirect_uri mismatch · unsupported response_type

---

### POST /oauth/authorize

Processes the login form. On success, redirects to `redirect_uri?code=<code>&state=<state>`.  
On failure, re-renders the form with an error message.

**Body** `application/x-www-form-urlencoded` (standard HTML form POST)

---

### POST /oauth/token

Exchanges an auth code for tokens, or refreshes an access token.

**Body** `application/x-www-form-urlencoded` or `application/json`

**Authorization code grant**
```
grant_type=authorization_code
&code=<code>
&redirect_uri=<uri>
&client_id=<id>
&client_secret=<secret>      ← confidential clients only
&code_verifier=<verifier>    ← required if code_challenge was sent
```

**Refresh token grant**
```
grant_type=refresh_token
&refresh_token=<token>
```

**Response** `200`
```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "<opaque>",
  "scope": "health:read"
}
```

**Errors** `400` invalid_grant · invalid_request · unsupported_grant_type  
`401` invalid_client

---

### POST /oauth/revoke

Revokes a refresh token (RFC 7009). Always returns `200`.

**Body** `application/x-www-form-urlencoded`
```
token=<refresh_token>
```

---

## Using OAuth tokens with the MCP endpoint

After obtaining an access token, send it as a Bearer header:
```
Authorization: Bearer <access_token>
```

The `/mcp` endpoint accepts both Bearer tokens (OAuth) and `x-api-key` headers (Claude Desktop stdio) — both are valid.
