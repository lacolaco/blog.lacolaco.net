#!/usr/bin/env bash
# search_events ビューの SQL を、固定の入力行 (search_logs_raw.fixture.ndjson) に対して BigQuery で実行し、
# 期待する行 (search_events.expected.tsv) と一致することを確かめる。
# 検索イベントだけが残り、管理用のログ・平文のログ・数値だけのログ・ログなしの行が入らないことが仕様である。
# BigQuery への認証 (bq) が要るため CI では実行しない。ビューの SQL を変えたらローカルで実行する。
#   使い方: bash infra/terraform/tests/search_events.test.sh
set -euo pipefail
cd "$(dirname "$0")"

python3 - <<'PY' > /tmp/search_events_test.sql
import json, re
def lit(v):
    return json.dumps(v, ensure_ascii=False)
rows = []
for line in open('search_logs_raw.fixture.ndjson', encoding='utf-8'):
    d = json.loads(line)
    logs = ', '.join(
        f"STRUCT({lit(l['Level'])} AS Level, [{', '.join(lit(m) for m in l['Message'])}] AS Message, {l['TimestampMs']} AS TimestampMs)"
        for l in d['Logs'])
    logs = f"[{logs}]" if logs else "ARRAY<STRUCT<Level STRING, Message ARRAY<STRING>, TimestampMs INT64>>[]"
    rows.append(f"STRUCT({d['EventTimestampMs']} AS EventTimestampMs, {lit(d['ScriptName'])} AS ScriptName, {lit(d['Outcome'])} AS Outcome, {logs} AS Logs)")
raw = "(SELECT * FROM UNNEST([" + ",\n".join(rows) + "]))"
tpl = open('../search_events.sql.tftpl', encoding='utf-8').read().replace('${raw_table}', raw)
print(f"SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E*SZ', searched_at) AS t, q, locale, hits, ms FROM ({tpl}) ORDER BY searched_at")
PY

bq query --nouse_legacy_sql --format=csv --maximum_bytes_billed=10000000 < /tmp/search_events_test.sql \
  | tail -n +2 | python3 -c '
import csv, sys
for r in csv.reader(sys.stdin):
    print("\t".join(r))
' > /tmp/search_events_actual.tsv
rm -f /tmp/search_events_test.sql

if diff -u search_events.expected.tsv /tmp/search_events_actual.tsv; then
  echo "ok"
else
  echo "ng" >&2; exit 1
fi
