#!/usr/bin/env bash
# Logpush ジョブを作る。冪等で、同名のジョブが既にあれば何もしない。
# 入力 (環境変数): CLOUDFLARE_ACCOUNT_ID、JOB_DEFINITION (JSON)、BUCKET。
# 所有権の確認: cf が確認ファイルをバケットに書き、その中身を読んでジョブの ownership_challenge に渡す。
# 認証情報とトークンの値は標準出力に出さない。
set -euo pipefail

name="$(python3 -c 'import json,os; print(json.loads(os.environ["JOB_DEFINITION"])["name"])')"
destination="$(python3 -c 'import json,os; print(json.loads(os.environ["JOB_DEFINITION"])["destination_conf"])')"

existing="$(cf logpush account-jobs list | python3 -c '
import json, sys
name = sys.argv[1]
print(sum(1 for j in json.load(sys.stdin) if j.get("name") == name))
' "$name")"
if [[ "$existing" != "0" ]]; then
  echo "同名の Logpush ジョブが既にある。作成しない: $name"
  exit 0
fi

filename="$(cf logpush account-ownership create --destination-conf "$destination" | python3 -c 'import json,sys; print(json.load(sys.stdin)["filename"])')"
challenge="$(gcloud storage cat "gs://${BUCKET}/${filename}" | tr -d '\n\r ')"

body="$(python3 -c '
import json, os, sys
d = json.loads(os.environ["JOB_DEFINITION"])
d["ownership_challenge"] = sys.argv[1]
print(json.dumps(d))
' "$challenge")"

# --kind edge は cf の引数検査 (既定値の空文字が choices に無い) を通すための指定で、ジョブの種類には影響しない (作成されるジョブの kind は空)
cf logpush account-jobs create --kind edge --body "$body" | python3 -c '
import json, sys
j = json.load(sys.stdin)
print("Logpush ジョブを作成した: id=%s name=%s enabled=%s" % (j["id"], j["name"], j["enabled"]))
'
