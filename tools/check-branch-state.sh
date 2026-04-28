#!/usr/bin/env bash
# SessionStart hook: surface current branch state for non-main branches.
# Output is shown to Claude as additional context so stale branches are caught
# before any mutating operation.

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || cd "$(pwd)"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [[ -z "$BRANCH" || "$BRANCH" == "main" || "$BRANCH" == "HEAD" ]]; then
  exit 0
fi

REMOTE_BRANCH=$(timeout 5 git ls-remote --heads origin "$BRANCH" 2>/dev/null | awk '{print $2}')

# Single gh call; parse via Go template to avoid jq dependency and 3x latency
PR_INFO=$(timeout 5 gh pr view "$BRANCH" --json state,number,mergedAt --template '{{.state}}|{{.number}}|{{.mergedAt}}' 2>/dev/null || echo "")
PR_STATE="${PR_INFO%%|*}"
PR_REST="${PR_INFO#*|}"
PR_NUMBER="${PR_REST%%|*}"
PR_MERGED_AT="${PR_REST#*|}"
[[ "$PR_MERGED_AT" == "<no value>" || "$PR_MERGED_AT" == "<nil>" ]] && PR_MERGED_AT=""

echo "## Branch state check"
echo ""
echo "- Current branch: \`$BRANCH\`"

if [[ -z "$REMOTE_BRANCH" ]]; then
  echo "- Remote branch: **NOT FOUND** (origin/$BRANCH does not exist)"
else
  echo "- Remote branch: exists"
fi

if [[ -z "$PR_NUMBER" ]]; then
  echo "- Associated PR: none"
else
  echo "- Associated PR: #$PR_NUMBER, state=$PR_STATE, mergedAt=$PR_MERGED_AT"
fi

if [[ "$PR_STATE" == "MERGED" || "$PR_STATE" == "CLOSED" ]]; then
  echo ""
  echo "**WARNING**: associated PR is $PR_STATE. This branch is stale - do not commit/push to it. Switch to main and start fresh."
fi
