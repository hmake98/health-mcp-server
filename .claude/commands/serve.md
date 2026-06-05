Start or inspect the development server.

Steps:
1. Check if already running: `curl -s http://localhost:3000/health`
   - If responding `{"ok":true}`: report "Server already running on :3000" and stop.
2. If not running: run `npm run dev` (this starts tsx watch, hot reload enabled).
3. Wait ~2 seconds, then curl /health again to confirm it started.
4. Show the port and confirm it's ready.

Do not background the process with & — run it so the user can see live logs.
