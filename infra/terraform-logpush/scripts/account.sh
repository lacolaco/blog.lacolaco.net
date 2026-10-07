#!/usr/bin/env bash
# data "external" 用。ゾーン名からアカウント ID を引いて JSON で返す。cf のログイン済みの OAuth を使う。
set -euo pipefail
zone_name="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["zone_name"])')"
cf zones list --name "$zone_name" 2>/dev/null | python3 -c '
import json, sys
zone = sys.argv[1]
zones = [z for z in json.load(sys.stdin) if z["name"] == zone]
if len(zones) != 1:
    sys.exit(f"zone {zone} が {len(zones)} 件ある (1 件のはず)")
print(json.dumps({"account_id": zones[0]["account"]["id"]}))
' "$zone_name"
