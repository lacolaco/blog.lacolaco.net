#!/usr/bin/env bash
# 使い方: delete-preview-service.sh <PR 番号>
# PR のプレビュー用 Cloud Run サービス web-pr-<番号> を削除する。本番の web には触れない。
set -uo pipefail

pr_number="${1:?PR 番号を渡す}"
if [[ ! "$pr_number" =~ ^[0-9]+$ ]]; then
  echo "PR 番号は数字で渡す: ${pr_number}" >&2
  exit 2
fi

if err=$(gcloud run services delete "web-pr-${pr_number}" --region asia-northeast1 --quiet 2>&1 >/dev/null); then
  exit 0
fi
# デプロイが Cloud Run まで進まなかった PR にはサービスが無い。片付けの目的は達しているので成功にする
if [[ "$err" == *"could not be found"* ]]; then
  exit 0
fi
echo "$err" >&2
exit 1
