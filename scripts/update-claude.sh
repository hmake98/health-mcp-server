#!/usr/bin/env bash
# Regenerates the FILE_TREE section in CLAUDE.md from the actual src/ layout.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE="$ROOT/CLAUDE.md"
TREE_FILE=$(mktemp)

# Write tree lines to temp file
find "$ROOT/src" -type f -name "*.ts" | sort | while read -r f; do
  rel="${f#"$ROOT/"}"
  printf "  %s\n" "$rel"
done > "$TREE_FILE"

# Replace content between markers using Python (available on macOS by default)
python3 - "$CLAUDE" "$TREE_FILE" <<'EOF'
import sys

claude_path = sys.argv[1]
tree_path = sys.argv[2]

with open(claude_path) as f:
    content = f.read()

with open(tree_path) as f:
    tree = f.read().rstrip()

start_marker = "<!-- FILE_TREE_START -->"
end_marker = "<!-- FILE_TREE_END -->"

before = content[:content.index(start_marker) + len(start_marker)]
after = content[content.index(end_marker):]

with open(claude_path, "w") as f:
    f.write(before + "\n" + tree + "\n" + after)
EOF

rm -f "$TREE_FILE"
echo "CLAUDE.md file tree updated."
