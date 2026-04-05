#!/usr/bin/env bash
# 指定PRの最新code-reviewのbodyを、現在のHEAD commitに対応するものに限定して取得する
# Usage: ./tools/get-latest-review.sh <PR_NUMBER>
set -euo pipefail

PR="${1:?Usage: $0 <PR_NUMBER>}"
HEAD_SHA=$(git rev-parse HEAD)

# HEAD commitに対応するレビューを取得。なければ最新レビューにフォールバック
REVIEW=$(gh pr view "$PR" --json reviews \
  --jq "[.reviews[] | select(.commit.oid == \"$HEAD_SHA\")] | last | .body")

if [[ -z "$REVIEW" || "$REVIEW" == "null" ]]; then
  echo "WARNING: No review found for HEAD commit $HEAD_SHA. Showing latest review instead." >&2
  REVIEW=$(gh pr view "$PR" --json reviews --jq '.reviews[-1].body')
fi

echo "$REVIEW"
