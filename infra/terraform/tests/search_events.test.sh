#!/usr/bin/env bash
# search_events ビューの SQL を、固定の入力行 (search_logs_raw.fixture.ndjson) に対して BigQuery で実行し、
# 期待する行 (search_events.expected.tsv) と一致することを確かめる。
# 検索イベントだけが残り、管理用のログ・平文のログ・数値だけのログ・ログなしの行・切り詰めで途中で切れた JSON が入らないことが仕様である。
# 空の検索語と 200 文字の検索語は行として残る。
# log_date は読んだファイルの経路 (workers/<YYYYMMDD>/) の日付 (UTC、Logpush が決める)。想定外の経路のファイルは NULL になり、問い合わせは失敗しない。
# BigQuery への認証 (bq) が要るため CI では実行しない。ビューの SQL を変えたらローカルで実行する。
#   使い方: bash infra/terraform/tests/search_events.test.sh
set -euo pipefail
cd "$(dirname "$0")"

# 一時ファイルは成功・失敗のどちらでも消す
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

python3 - <<'PY' > "$work/test.sql"
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
    # 外部表の疑似列 _FILE_NAME (読んだファイルの URI)。固定の入力行では _FileName で与える
    file_name = d.get('_FileName', 'gs://blog-lacolaco-net-search-logs/workers/20261006/dummy.log.gz')
    rows.append(f"STRUCT({lit(file_name)} AS _FILE_NAME, {d['EventTimestampMs']} AS EventTimestampMs, {lit(d['ScriptName'])} AS ScriptName, {lit(d['Outcome'])} AS Outcome, {logs} AS Logs)")
raw = "(SELECT * FROM UNNEST([" + ",\n".join(rows) + "]))"
tpl = open('../search_events.sql.tftpl', encoding='utf-8').read().replace('${raw_table}', raw)
print(f"SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E*SZ', searched_at) AS t, q, locale, hits, ms, log_date FROM ({tpl}) ORDER BY searched_at")
PY

bq query --nouse_legacy_sql --format=csv --maximum_bytes_billed=10000000 < "$work/test.sql" \
  | tail -n +2 | python3 -c '
import csv, sys
for r in csv.reader(sys.stdin):
    print("\t".join(r))
' > "$work/actual.tsv"

if diff -u search_events.expected.tsv "$work/actual.tsv"; then
  echo "ok"
else
  echo "ng" >&2; exit 1
fi
