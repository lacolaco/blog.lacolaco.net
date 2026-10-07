#
# 検索ログの Logpush ジョブ (Workers Trace Events → GCS)
#
# 送り先のバケットと、Logpush の書き込み元への IAM は infra/terraform の search_logs.tf が作る (CI が apply)。
# このモジュールは Cloudflare 側のジョブだけを作る。apply は先に infra/terraform が反映されてから行う。
#
# Cloudflare プロバイダーを使わず、terraform_data の local-exec から cf CLI を呼ぶ。理由は README を参照
# (プロバイダーは API トークンしか受け付けず、Logs Write を持つトークンの作成にはトークン作成の権限が要る。
#  cf はログイン済みの OAuth を自分で使うので、トークンを Terraform に渡さずに済む)。
#

data "google_storage_bucket" "search_logs" {
  name = var.search_logs_bucket_name
}

# ゾーン名からアカウント ID を引く (Logpush のジョブはゾーンの属するアカウントに作る)。
data "external" "account" {
  program = ["bash", "${path.module}/scripts/account.sh"]
  query = {
    zone_name = var.zone_name
  }
}

locals {
  account_id = data.external.account.result.account_id
  # Logpush のジョブ名は ^[a-zA-Z0-9._-]*$ に限られる (空白は API が 400 で拒否する)
  job_name = "${var.search_worker_name}-workers-trace-events"

  # {DATE} は Logpush が日付に置き換える。infra/terraform の外部表の URI (workers/*.log.gz) と prefix を合わせる
  destination_conf = "gs://${data.google_storage_bucket.search_logs.name}/workers/{DATE}"

  # ジョブの定義。変わると terraform_data が置き換わり、ジョブを作り直す。
  # フィルターに使えるのは文字列などの欄だけで、Logs (array) は使えない。そのため Worker 単位で絞り、
  # 検索イベントの選別は BigQuery のビュー (search_events) で行う。
  # field_names は infra/terraform の外部表のスキーマと合わせる。Event (リクエストの詳細) は送らない。
  job_definition = {
    name             = local.job_name
    dataset          = "workers_trace_events"
    destination_conf = local.destination_conf
    enabled          = true
    filter = jsonencode({
      where = { key = "ScriptName", operator = "eq", value = var.search_worker_name }
    })
    output_options = {
      output_type = "ndjson"
      field_names = ["EventTimestampMs", "ScriptName", "Outcome", "Logs"]
    }
  }
}

# 実在のジョブの状態。plan で現状 (存在、有効か、直近のエラー) が分かるようにする。
data "external" "job" {
  program = ["bash", "${path.module}/scripts/job-status.sh"]
  query = {
    account_id = local.account_id
    name       = local.job_name
  }
}

resource "terraform_data" "logpush_job" {
  triggers_replace = [local.job_definition]

  # destroy 時は self だけを参照できるため、必要な値をこの属性に持たせる
  input = {
    account_id = local.account_id
    name       = local.job_name
  }

  provisioner "local-exec" {
    command     = "bash ${path.module}/scripts/create-job.sh"
    interpreter = ["bash", "-c"]
    environment = {
      CLOUDFLARE_ACCOUNT_ID = local.account_id
      JOB_DEFINITION        = jsonencode(local.job_definition)
      BUCKET                = data.google_storage_bucket.search_logs.name
    }
  }

  provisioner "local-exec" {
    when        = destroy
    command     = "bash ${path.module}/scripts/delete-job.sh"
    interpreter = ["bash", "-c"]
    environment = {
      CLOUDFLARE_ACCOUNT_ID = self.input.account_id
      JOB_NAME              = self.input.name
    }
  }
}

# Cloudflare 側の直接の変更 (ダッシュボードでの停止や削除) は、terraform_data の定義が変わらないと検出できない。
# そのため plan で実在の状態を読み、ジョブが無い、止まっている、エラーがあるときは警告にする。
# 直すには `terraform apply -replace=terraform_data.logpush_job` を実行する。
check "job_status" {
  assert {
    condition     = data.external.job.result.exists == "true" && data.external.job.result.enabled == "true" && data.external.job.result.error == ""
    error_message = "Logpush ジョブが無い、止まっている、またはエラーがある (exists=${data.external.job.result.exists}, enabled=${data.external.job.result.enabled}, error=${data.external.job.result.error})。`terraform apply -replace=terraform_data.logpush_job` で作り直す。初回の apply 前は警告になる。"
  }
}
