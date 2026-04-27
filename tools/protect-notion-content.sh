#!/bin/bash
# PreToolUse hook for Edit/Write/MultiEdit/NotebookEdit
# Blocks edits to Notion-sourced content (.md / .en.md under src/content/post/notion/)
# Rationale: these files are auto-generated (Notion → notion-sync, ja → auto-translate).
# Direct edits get overwritten on next sync. Content fixes belong upstream (Notion / pipeline).
#
# Exit codes are managed explicitly (no `set -e`): unexpected non-zero exits would be
# interpreted as undefined hook behavior by Claude Code. Always exit 0 (allow) on
# environment issues (missing jq, malformed input) — fail-open is safer here than blocking
# legitimate edits because of a tool-environment problem.

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)

if [ -z "$file_path" ]; then
  exit 0
fi

# Match src/content/post/notion/**/*.md (both .md and .en.md)
case "$file_path" in
  */src/content/post/notion/*.md)
    cat <<EOF >&2
Cannot edit Notion-sourced content directly: $file_path

These files are auto-generated:
  - .md      → Notion (via notion-sync). Fix in Notion.
  - .en.md   → ja .md (via auto-translate). Fix in tools/auto-translate/ pipeline (prompt / proofreader / validator).

Direct edits are overwritten on next sync. See CLAUDE.md rule 2b.
EOF
    exit 2
    ;;
esac

exit 0
