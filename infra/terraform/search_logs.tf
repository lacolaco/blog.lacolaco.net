#
# 検索ログの送り先 (Workers Trace Events → Logpush → GCS)
#
# 経路: Worker blog-search → Logpush (infra/terraform-credentials) → この GCS バケット
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
  location = "ASIA-NORTHEAST1" # BigQuery の search_analytics (asia-northeast1) と同じ。外部表は同じロケーションの bucket しか読めない

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

# 検索ログ専用のデータセット。likes_analytics に混ぜると名前と中身が合わないため分ける。
# github-actions SA にはデータセットを作る権限 (bigquery.datasets.create) が無く、プロジェクト全体へは広げない。
# そのためデータセットとこのデータセットへの IAM (下の github_actions_search_analytics_data_owner) は、
# 初回だけ権限のある利用者がローカルで apply して作る。作成後は CI の apply で差分が出ない。
resource "google_bigquery_dataset" "search_analytics" {
  dataset_id  = "search_analytics"
  location    = "asia-northeast1"
  description = "検索 API (Worker blog-search) の検索ログ。Logpush が GCS に書いた生データの外部表と、検索イベントだけのビュー"
}

# CI 上の Terraform は、このデータセットに対して次の API call を行う必要がある (iam.tf の likes_analytics と同じ理由):
#   - bigquery.datasets.get / getIamPolicy / setIamPolicy
#   - bigquery.tables.create など (外部表とビューの管理)
# これらを同時に持つ既定ロールは、データセット単位では dataOwner のみ。当該データセットは公開ブログの検索語で
# 機密性が低く、Terraform が触るのは表とビューの定義だけなので、custom role にせず dataOwner を採用する
# (likes_analytics と同じ判断)。付与はこのデータセットに限り、プロジェクト全体の権限は広げない。
resource "google_bigquery_dataset_iam_member" "github_actions_search_analytics_data_owner" {
  project    = data.google_project.current.project_id
  dataset_id = google_bigquery_dataset.search_analytics.dataset_id
  role       = "roles/bigquery.dataOwner"
  member     = "serviceAccount:${data.google_service_account.github_actions.email}"
}

# 外部表の URI に使えるワイルドカードは 1 個だけ。`workers/*.log.gz` は Logpush の出力 (workers/<日付>/*.log.gz) に
# 一致し、同じ prefix に書かれる所有権確認の .txt ファイルを読まない。
# 取り込み間隔は約 1 分だが、外部表は読むたびに GCS を走査するため、表の更新は不要。
resource "google_bigquery_table" "search_logs_raw" {
  dataset_id = google_bigquery_dataset.search_analytics.dataset_id
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

    # Logpush の field_names (infra/terraform-credentials) と合わせる。Message は console.log の引数ごとの文字列配列
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
  dataset_id = google_bigquery_dataset.search_analytics.dataset_id
  table_id   = "search_events"

  description         = "検索 API の検索イベント (1 検索 1 行)。hits は API が返した件数 (上限 20) で、総数ではない"
  deletion_protection = true

  view {
    query = templatefile("${path.module}/search_events.sql.tftpl", {
      raw_table = "`${data.google_project.current.project_id}.${google_bigquery_table.search_logs_raw.dataset_id}.${google_bigquery_table.search_logs_raw.table_id}`"
    })
    use_legacy_sql = false
  }
}
