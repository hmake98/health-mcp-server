#!/usr/bin/env bash
# PostToolUse asyncRewake hook — runs tsc after any .ts file write/edit.
# stdin: JSON payload from Claude Code. Exits 2 to rewake Claude with errors.

PAYLOAD=$(cat)
FILE=$(echo "$PAYLOAD" | jq -r '.tool_input.file_path // ""' 2>/dev/null)

[[ "$FILE" == *.ts ]] || exit 0

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=$(cd "$ROOT" && npx --no-install tsc --noEmit 2>&1)

[ -z "$ERRORS" ] && exit 0
echo "$ERRORS"
exit 2
