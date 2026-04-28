#!/usr/bin/env bash
# PreToolUse hook for Edit/Write/MultiEdit/NotebookEdit:
# Block file modifications when current branch is stale (merged/closed PR).
# This catches the case where Claude continues working on a branch after its PR
# was merged elsewhere — the SessionStart-only approach misses mid-session staleness.

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || cd "$(pwd)"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [[ -z "$BRANCH" || "$BRANCH" == "main" || "$BRANCH" == "HEAD" ]]; then
  exit 0
fi

# Primary signal: remote branch existence. GitHub auto-deletes branches on merge,
# so a missing remote is the most reliable "stale" indicator and avoids gh auth latency.
# Capture timeout exit code (124) separately from "branch not found" (empty output, exit 0)
# so a network outage doesn't cascade into a second 5s gh call on every Edit.
LS_OUT=$(timeout 3 git ls-remote --heads origin "$BRANCH" 2>/dev/null)
LS_EXIT=$?
if [[ $LS_EXIT -eq 124 ]]; then
  exit 0  # network timeout — assume live, do not block
fi
REMOTE_BRANCH=$(echo "$LS_OUT" | awk '{print $2}')

if [[ -n "$REMOTE_BRANCH" ]]; then
  exit 0
fi

# Remote missing. Confirm via PR state to distinguish "never pushed" from "merged & deleted".
PR_INFO=$(timeout 5 gh pr view "$BRANCH" --json state,number --template '{{.state}}|{{.number}}' 2>/dev/null)
GH_EXIT=$?
if [[ $GH_EXIT -eq 124 ]]; then
  exit 0  # gh timeout — cannot determine state, do not block
fi
PR_STATE="${PR_INFO%%|*}"
PR_NUMBER="${PR_INFO#*|}"

if [[ "$PR_STATE" == "MERGED" || "$PR_STATE" == "CLOSED" ]]; then
  cat >&2 <<EOF
Blocked: branch '$BRANCH' is stale.
Associated PR #$PR_NUMBER is $PR_STATE and the remote branch was deleted.
Do not commit/edit on this branch. Switch to main and start a fresh branch:
  git checkout main && git pull && git checkout -b <new-branch>
EOF
  exit 2
fi

exit 0
