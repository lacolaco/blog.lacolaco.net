#!/usr/bin/env bash
# 使い方: remove-revision-tag.sh <PR 番号>
# Cloud Run の web からプレビューのタグ pr-<番号> を外す。
# 別の PR の更新と重なって競合 (ABORTED) したときだけ、有限回再試行する。
set -uo pipefail

pr_number="${1:?PR 番号を渡す}"
max_attempts="${MAX_ATTEMPTS:-6}"
retry_delay="${RETRY_DELAY_SECONDS:-5}"

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  if err=$(gcloud run services update-traffic web --region asia-northeast1 --remove-tags "pr-${pr_number}" 2>&1 >/dev/null); then
    exit 0
  fi
  echo "$err" >&2
  # 権限や存在しないサービスなど、再試行で直らない失敗は即座に終える
  if [[ "$err" != *ABORTED* ]]; then
    exit 1
  fi
  if ((attempt < max_attempts)); then
    # 同時に失敗した側が同じ間隔で再衝突しないよう、待ち時間に揺らぎを足す
    sleep "$((retry_delay + (retry_delay > 0 ? RANDOM % retry_delay : 0)))"
  fi
done

echo "競合が ${max_attempts} 回続き、タグ pr-${pr_number} を外せなかった" >&2
exit 1
