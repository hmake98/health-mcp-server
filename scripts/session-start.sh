#!/usr/bin/env bash
# SessionStart hook — injects project context into Claude's first turn.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
LAST=$(git log -1 --format="%h %s" 2>/dev/null || echo "no commits")

TS_ERRORS=$(npx --no-install tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")

SERVER="down"
curl -sf http://localhost:3000/health 2>/dev/null | grep -q '"ok":true' && SERVER=":3000 up"

CONTEXT="[health-mcp] branch=$BRANCH | dirty=$DIRTY file(s) | last commit: $LAST | tsc errors=$TS_ERRORS | server=$SERVER"

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$CONTEXT"
