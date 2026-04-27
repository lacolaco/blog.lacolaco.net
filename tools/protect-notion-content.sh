#!/bin/bash
# PreToolUse hook for Edit/Write/MultiEdit/NotebookEdit
# Blocks edits to Notion-sourced content (.md / .en.md under src/content/post/notion/)
# Rationale: these files are auto-generated (Notion → notion-sync, ja → auto-translate).
# Direct edits get overwritten on next sync. Content fixes belong upstream (Notion / pipeline).

set -e

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')

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
