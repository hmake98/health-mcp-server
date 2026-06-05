Test a local API endpoint. Arguments: $ARGUMENTS

Expected format: `<METHOD> <path> [json body]`
Examples: `GET /health` · `POST /api/health/vitals {"userId":"me","records":[...]}`

Steps:
1. Check if the server is up: `curl -s http://localhost:3000/health`
   - If it's not running, tell me and stop — do not start it in background silently.
2. Source the API key: `source .env 2>/dev/null || true`, then use $API_SECRET in the x-api-key header.
3. Build and run the curl command with `-s -w "\nHTTP %{http_code}"`.
4. Pretty-print the JSON response with `jq .` if possible.
5. If the response is an error, explain what likely caused it based on the request payload and the validation schema in `src/api/routes/health.ts`.

Never print the API_SECRET in clear text in your response.
