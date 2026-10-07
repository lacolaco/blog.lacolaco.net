#!/usr/bin/env bash
# data "external" 用。同名の Logpush ジョブの状態を JSON (値はすべて文字列) で返す。認証情報は出力しない。
set -euo pipefail
query="$(cat)"
account_id="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["account_id"])' "$query")"
name="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["name"])' "$query")"
CLOUDFLARE_ACCOUNT_ID="$account_id" cf logpush account-jobs list 2>/dev/null | python3 -c '
import json, sys
name = sys.argv[1]
jobs = [j for j in json.load(sys.stdin) if j.get("name") == name]
if len(jobs) > 1:
    sys.exit(f"同名のジョブが {len(jobs)} 件ある: {name}")
if not jobs:
    print(json.dumps({"exists": "false", "id": "", "enabled": "false", "error": "", "last_complete": ""}))
else:
    j = jobs[0]
    print(json.dumps({
        "exists": "true",
        "id": str(j["id"]),
        "enabled": str(bool(j.get("enabled"))).lower(),
        "error": j.get("error_message") or "",
        "last_complete": j.get("last_complete") or "",
    }))
' "$name"
