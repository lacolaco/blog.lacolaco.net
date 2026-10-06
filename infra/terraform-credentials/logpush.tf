#
# 検索ログの Logpush (Workers Trace Events → GCS)
#
# 送り先のバケットと、Logpush の書き込み元への IAM は infra/terraform の search_logs.tf が作る (CI が apply)。
# このファイルは Cloudflare 側のジョブだけを作る。apply は先に infra/terraform が反映されてから行う。
#

data "google_storage_bucket" "search_logs" {
  name = var.search_logs_bucket_name
}

locals {
  # {DATE} は Logpush が日付に置き換える。外部表の URI (workers/*.log.gz) と prefix を合わせる
  search_logs_destination = "gs://${data.google_storage_bucket.search_logs.name}/workers/{DATE}"
}

# 送り先の所有権確認。Cloudflare が確認用のファイルをバケットに書き、その中身がジョブに渡すトークンになる。
# 手作業でトークンを写さず、同じ apply の中でバケットから読んで渡す。
resource "cloudflare_logpush_ownership_challenge" "search_logs" {
  account_id       = local.cloudflare_account_id
  destination_conf = local.search_logs_destination
}

data "google_storage_bucket_object_content" "search_logs_challenge" {
  bucket = data.google_storage_bucket.search_logs.name
  name   = cloudflare_logpush_ownership_challenge.search_logs.filename
}

resource "cloudflare_logpush_job" "search_logs" {
  account_id       = local.cloudflare_account_id
  name             = "${var.search_worker_name} workers trace events"
  dataset          = "workers_trace_events"
  destination_conf = local.search_logs_destination
  enabled          = true

  # Logpush のフィルターに使えるのは文字列などの欄だけで、Logs (array) は使えない。
  # そのため Worker 単位で絞り、検索イベントの選別は BigQuery のビュー (search_events) で行う。
  filter = jsonencode({
    where = { key = "ScriptName", operator = "eq", value = var.search_worker_name }
  })

  # 欄は infra/terraform の外部表のスキーマと合わせる。Event (リクエストの詳細) は検索語以外の情報を含むため送らない。
  output_options = {
    output_type = "ndjson"
    field_names = ["EventTimestampMs", "ScriptName", "Outcome", "Logs"]
  }

  ownership_challenge = data.google_storage_bucket_object_content.search_logs_challenge.content

  lifecycle {
    # トークンは作成時にしか使われず、確認ファイルは何度でも読み直せるが内容が変わりうる。
    # 変わるたびにジョブを作り直す (= 取りこぼしが出る) のを避ける
    ignore_changes = [ownership_challenge]
  }
}
