Generate a ready-to-run curl command for: $ARGUMENTS

$ARGUMENTS = endpoint name or path (e.g. "vitals", "sleep", "/api/health/workouts")

Steps:
1. Find the matching Zod schema in `src/api/routes/health.ts`
2. Build a minimal valid JSON body with realistic sample values:
   - Use actual enum values from the schema
   - Use ISO 8601 dates (today and today-1h for start/end)
   - Include 2–3 records in the records array
3. Print a ready-to-run curl block:

```sh
source .env
curl -s -X POST http://localhost:3000/api/health/<resource> \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_SECRET" \
  -d '<json>' | jq .
```

4. Show expected response shape below the command.

Do not run it — just print it. Do not hardcode the API_SECRET value.
