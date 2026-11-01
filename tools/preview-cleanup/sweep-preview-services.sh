#!/usr/bin/env bash
# 使い方: sweep-preview-services.sh
# 開いていない PR のプレビュー用サービスを削除する。閉じたときの片付けが失敗して残ったサービスを掃除する。
set -uo pipefail

here="$(dirname "$0")"

# 先にサービスを列挙してから開いている PR を取る。逆だと、その間に開かれた PR のサービスを消しうる
services=$(gcloud run services list --region asia-northeast1 --filter 'metadata.labels.purpose=preview' --format 'value(metadata.name)') || exit 1
open_prs=$(gh pr list --state open --limit 1000 --json number --jq '.[].number') || exit 1

status=0
for name in $services; do
  # 本番の web など、プレビューの名前の形でないサービスは対象にしない
  [[ "$name" =~ ^web-pr-([0-9]+)$ ]] || continue
  number="${BASH_REMATCH[1]}"
  if grep -qx "$number" <<<"$open_prs"; then
    continue
  fi
  "$here/delete-preview-service.sh" "$number" || status=1
done
exit "$status"
