#
# 検索ログの送り先 (Workers Trace Events → Logpush → GCS)
#
# 経路: Worker blog-search → Logpush (infra/terraform-logpush) → この GCS バケット
#       → BigQuery 外部表 → 検索イベントだけのビュー。構成と運用は infra/README.md を参照。
#

# Logpush の書き込み元は Cloudflare 側の共有サービスアカウント。値は Cloudflare の公式文書
# (Logpush → Google Cloud Storage) に固定で載っており、鍵の発行は要らない。
locals {
  cloudflare_logpush_service_account = "logpush@cloudflare-data.iam.gserviceaccount.com"
}

# 保持期間 (lifecycle_rule) は設けない。検索語に個人情報が含まれる見込みが無いというプロダクトオーナーの判断
# (2026-10-06、LACO-611) により、マスクも保持期間の制限も行わない。生データの削除は外部表から行が消えるため、
# 分析の蓄積を保つ目的でも消さない。個人情報が含まれると分かったら、ここに lifecycle_rule を足す。
resource "google_storage_bucket" "search_logs" {
  name     = "${data.google_project.current.project_id}-search-logs"
  location = "ASIA-NORTHEAST1" # BigQuery の blog_analytics (asia-northeast1) と同じ。外部表は同じロケーションの bucket しか読めない

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}

# Logpush は所有権の確認ファイルの書き込みと読み戻しに objectAdmin を要する (公式文書の指定)。
resource "google_storage_bucket_iam_member" "search_logs_logpush_writer" {
  bucket = google_storage_bucket.search_logs.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${local.cloudflare_logpush_service_account}"
}

#
# BigQuery: 生データの外部表と、検索イベントだけのビュー
#

# ブログが自分で集めるデータ (検索ログ、今後のクリックの記録など) を置く汎用のデータセット。
# 既存の likes_analytics (いいねの集計) とは分け、いいねの移行はこの変更に含めない。
# github-actions SA にはデータセットを作る権限 (bigquery.datasets.create) が無く、プロジェクト全体へは広げない。
# そのためデータセットとこのデータセットへの IAM (下の github_actions_blog_analytics_data_owner) は、
# 初回だけ権限のある利用者がローカルで apply して作る。作成後は CI の apply で差分が出ない。
resource "google_bigquery_dataset" "blog_analytics" {
  dataset_id  = "blog_analytics"
  location    = "asia-northeast1"
  description = "ブログが自分で集めるデータの置き場 (検索ログ、今後のクリックの記録など)。現在は検索 API (Worker blog-search) の検索ログで、Logpush が GCS に書いた生データの外部表と、検索イベントだけのビューがある"
}

# CI 上の Terraform は、このデータセットに対して次の API call を行う必要がある (iam.tf の likes_analytics と同じ理由):
#   - bigquery.datasets.get / getIamPolicy / setIamPolicy
#   - bigquery.tables.create など (外部表とビューの管理)
# これらを同時に持つ既定ロールは、データセット単位では dataOwner のみ。当該データセットは公開ブログの検索語で
# 機密性が低く、Terraform が触るのは表とビューの定義だけなので、custom role にせず dataOwner を採用する
# (likes_analytics と同じ判断)。付与はこのデータセットに限り、プロジェクト全体の権限は広げない。
resource "google_bigquery_dataset_iam_member" "github_actions_blog_analytics_data_owner" {
  project    = data.google_project.current.project_id
  dataset_id = google_bigquery_dataset.blog_analytics.dataset_id
  role       = "roles/bigquery.dataOwner"
  member     = "serviceAccount:${data.google_service_account.github_actions.email}"
}

# 外部表の URI に使えるワイルドカードは 1 個だけ。`workers/*.log.gz` は Logpush の出力 (workers/<日付>/*.log.gz) に
# 一致し、同じ prefix に書かれる所有権確認の .txt ファイルを読まない。
# hive パーティション (mode=CUSTOM、{log_date:STRING}) は、key=value でない経路 workers/<日付>/ では使えない
# (実データで Incompatible partition schemas になった)。日付で絞る手段は search_events ビューの log_date (疑似列 _FILE_NAME)。
# 取り込み間隔は約 1 分だが、外部表は読むたびに GCS を走査するため、表の更新は不要。
resource "google_bigquery_table" "search_logs_raw" {
  dataset_id = google_bigquery_dataset.blog_analytics.dataset_id
  table_id   = "search_logs_raw"

  description         = "Worker blog-search の Workers Trace Events (Logpush が GCS に書く NDJSON)。検索イベントの抽出は search_events ビューを使う"
  deletion_protection = true

  external_data_configuration {
    autodetect    = false
    source_format = "NEWLINE_DELIMITED_JSON"
    compression   = "GZIP"
    source_uris   = ["gs://${google_storage_bucket.search_logs.name}/workers/*.log.gz"]

    # Logpush の出力には Exceptions など使わない欄もある。スキーマに無い欄は無視する
    ignore_unknown_values = true

    # Logpush の field_names (infra/terraform-logpush) と合わせる。Message は console.log の引数ごとの文字列配列
    schema = jsonencode([
      { name = "EventTimestampMs", type = "INT64" },
      { name = "ScriptName", type = "STRING" },
      { name = "Outcome", type = "STRING" },
      {
        name = "Logs", type = "RECORD", mode = "REPEATED", fields = [
          { name = "Level", type = "STRING" },
          { name = "Message", type = "STRING", mode = "REPEATED" },
          { name = "TimestampMs", type = "INT64" },
        ]
      },
    ])
  }
}

# Logpush のフィルターは Logs (array) を条件に使えないため、検索イベントの選別はここで行う。
# 検索以外のイベント (管理用エンドポイント、平文のログ) はこのビューに入らない。
resource "google_bigquery_table" "search_events" {
  dataset_id = google_bigquery_dataset.blog_analytics.dataset_id
  table_id   = "search_events"

  description         = "検索 API の検索イベント (1 行 = API へのリクエスト 1 回。入力途中の語も別の行になる。切り詰めや例外で行が欠けうる)。列の意味は各列の説明と infra/README.md を参照。hits は API が返した件数 (上限 20) で、総数ではない。search_id は 1 回の検索の識別子で、同じ log_date で同じ search_id の行は 1 行にしてある (識別子を足す前の行は NULL で、そのまま残る)。log_date (経路の UTC の日付、YYYYMMDD) で絞ると、その日のファイルだけを読む"
  deletion_protection = true

  # 列の説明。ビューの SQL は変えず、schema の description だけを足す (BigQuery の列の説明は
  # `bq show --schema` と INFORMATION_SCHEMA.COLUMN_FIELD_PATHS から読める)。列の表は infra/README.md の「ビューの列」と
  # 同じ事実を書くので、どちらかを直したらもう一方も直す。列の名前と順は SQL の最も外側の SELECT に合わせる
  # (tools/search-worker/view-docs.spec.ts が確かめる)。
  schema = jsonencode([
    { name = "searched_at", type = "TIMESTAMP", mode = "NULLABLE", description = "検索の時刻 (UTC)。元は Worker が検索ごとに出したログの出力時刻 (Workers Trace Events の Logs[].TimestampMs)。日ごとの集計を JST で行うときは DATE(searched_at, 'Asia/Tokyo') を使う。読むファイルを絞る日付は searched_at ではなく log_date" },
    { name = "q", type = "STRING", mode = "NULLABLE", description = "検索語。大文字小文字と前後の空白は入力のまま (Angular と angular は別の語)。q を省略した検索は空文字列になる。1 回の検索操作で、入力途中の語も別の行になる (UI は入力が 200ms 止まるたびに検索を送る)。そのため行数は、検索操作の数ではなく API へのリクエストの数" },
    { name = "locale", type = "STRING", mode = "NULLABLE", description = "検索の言語。ja または en。API はそれ以外を 400 で拒否し、ログも出さないので、この 2 値以外は入らない" },
    { name = "hits", type = "INT64", mode = "NULLABLE", description = "API が返した件数。上限は 20 で、総数ではない。20 は 20 件以上を意味する" },
    { name = "ms", type = "INT64", mode = "NULLABLE", description = "Worker がリクエストを受けてから検索結果を得るまでの処理時間 (ミリ秒)。読者が待った時間ではなく、ネットワークの時間を含まない。Workers の時刻は I/O の後にしか進まず、粗い値になりうる" },
    { name = "search_id", type = "STRING", mode = "NULLABLE", description = "1 回の検索 (API へのリクエスト 1 回) の識別子。Worker が検索ごとに作る乱数の UUID で、検索語や読者から導かない。同じ log_date で search_id が同じ行は 1 行にしてある。識別子を足す前に書かれた行は NULL で、重複を除けずそのまま残る" },
    { name = "log_date", type = "STRING", mode = "NULLABLE", description = "読んだファイルの経路 workers/<YYYYMMDD>/ の日付 (例 '20261007')。Logpush が決める UTC の日付で、JST ではなく、searched_at の日付とも JST の 0 時から 9 時の検索で一致しない。WHERE log_date = '...' で直接比較すると、その日のファイルだけを読む。想定外の経路のファイルでは NULL" },
  ])

  view {
    query = templatefile("${path.module}/search_events.sql.tftpl", {
      raw_table = "`${data.google_project.current.project_id}.${google_bigquery_table.search_logs_raw.dataset_id}.${google_bigquery_table.search_logs_raw.table_id}`"
    })
    use_legacy_sql = false
  }
}

# search_events が取り除いた呼び出しの件数。取りこぼしの割合の出し方は infra/README.md の「取りこぼしの割合」を参照。
# 列の説明は schema に書く (BigQuery のコンソールと INFORMATION_SCHEMA から読める)。
resource "google_bigquery_table" "search_log_quality" {
  dataset_id = google_bigquery_dataset.blog_analytics.dataset_id
  table_id   = "search_log_quality"

  description         = "検索ログの呼び出し (Logpush の 1 行 = Worker の 1 回の実行) を、search_events に入ったか、入らなかった理由は何かで分けた件数。取りこぼしの割合を出すために使う。Logpush 自体の欠落は数えられない。log_date で絞ると、その日のファイルだけを読む"
  deletion_protection = true

  schema = jsonencode([
    { name = "log_date", type = "STRING", mode = "NULLABLE", description = "読んだファイルの経路 workers/<YYYYMMDD>/ の日付 (例 '20261007')。Logpush が決める UTC の日付で、JST ではない。想定外の経路のファイルでは NULL" },
    { name = "outcome", type = "STRING", mode = "NULLABLE", description = "Workers Trace Events の Outcome。正常は ok。ok 以外 (exception、exceededCpu、exceededMemory、canceled など) が例外の種類" },
    { name = "reason", type = "STRING", mode = "NULLABLE", description = "search_events との関係。kept (検索イベントが取れた)、truncated (検索の JSON が切り詰めで途中で切れた)、exception (outcome が ok でない)、unparsable (JSON として解釈できないログがあり、上のどれでもない)、other (検索イベントも問題も無い。管理用の呼び出しなど)。実行ごとに最初に当てはまる 1 つ。取りこぼしの疑いは truncated、exception、unparsable" },
    { name = "invocations", type = "INT64", mode = "NULLABLE", description = "その (log_date, outcome, reason) の呼び出しの件数" },
  ])

  view {
    query = templatefile("${path.module}/search_log_quality.sql.tftpl", {
      raw_table = "`${data.google_project.current.project_id}.${google_bigquery_table.search_logs_raw.dataset_id}.${google_bigquery_table.search_logs_raw.table_id}`"
    })
    use_legacy_sql = false
  }
}
