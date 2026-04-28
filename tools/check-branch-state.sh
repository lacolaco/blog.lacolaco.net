#!/usr/bin/env bash
# SessionStart hook: surface current branch state for non-main branches.
# Output is shown to Claude as additional context so stale branches are caught
# before any mutating operation.

set -e

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [[ -z "$BRANCH" || "$BRANCH" == "main" || "$BRANCH" == "HEAD" ]]; then
  exit 0
fi

REMOTE_BRANCH=$(git ls-remote --heads origin "$BRANCH" 2>/dev/null | awk '{print $2}')
PR_JSON=$(gh pr view "$BRANCH" --json number,state,mergedAt 2>/dev/null || echo "")

echo "## Branch state check"
echo ""
echo "- Current branch: \`$BRANCH\`"

if [[ -z "$REMOTE_BRANCH" ]]; then
  echo "- Remote branch: **NOT FOUND** (origin/$BRANCH does not exist)"
else
  echo "- Remote branch: exists"
fi

if [[ -z "$PR_JSON" ]]; then
  echo "- Associated PR: none"
else
  STATE=$(echo "$PR_JSON" | jq -r .state)
  NUMBER=$(echo "$PR_JSON" | jq -r .number)
  MERGED_AT=$(echo "$PR_JSON" | jq -r .mergedAt)
  echo "- Associated PR: #$NUMBER, state=$STATE, mergedAt=$MERGED_AT"
fi

PR_STATE=$(echo "$PR_JSON" | jq -r .state 2>/dev/null || echo "")
if [[ "$PR_STATE" == "MERGED" || "$PR_STATE" == "CLOSED" ]]; then
  echo ""
  echo "**WARNING**: associated PR is $PR_STATE. This branch is stale - do not commit/push to it. Switch to main and start fresh."
fi
