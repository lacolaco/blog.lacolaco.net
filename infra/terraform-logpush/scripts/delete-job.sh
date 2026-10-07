#!/usr/bin/env bash
# Logpush ジョブを削除する。冪等で、同名のジョブが無ければ何もしない。
# 入力 (環境変数): CLOUDFLARE_ACCOUNT_ID、JOB_NAME。
set -euo pipefail

ids="$(cf logpush account-jobs list | python3 -c '
import json, sys
name = sys.argv[1]
print(" ".join(str(j["id"]) for j in json.load(sys.stdin) if j.get("name") == name))
' "$JOB_NAME")"

if [[ -z "$ids" ]]; then
  echo "削除するジョブが無い: $JOB_NAME"
  exit 0
fi
for id in $ids; do
  cf logpush account-jobs delete "$id" --force > /dev/null
  echo "Logpush ジョブを削除した: id=$id"
done
