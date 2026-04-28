#!/usr/bin/env bash
# PreToolUse hook: block file edits when current branch's PR is MERGED/CLOSED.
# Fail-open: any error (no gh auth, network down, no PR, etc) → allow.

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
[[ -z "$BRANCH" || "$BRANCH" == "main" || "$BRANCH" == "HEAD" ]] && exit 0

STATE=$(timeout 5 gh pr view "$BRANCH" --json state --template '{{.state}}' 2>/dev/null) || exit 0

case "$STATE" in
  MERGED|CLOSED)
    echo "Blocked: branch '$BRANCH' has a $STATE PR. Switch to main and start a fresh branch:" >&2
    echo "  git checkout main && git pull && git checkout -b <new-branch>" >&2
    exit 2
    ;;
esac
exit 0
