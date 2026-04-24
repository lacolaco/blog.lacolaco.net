#
# Data sources
#

data "google_project" "current" {}

# github-actions SA は CI/CD 基盤のため Terraform 管理外。data source で参照し、
# リネーム・再作成を検出可能にする
data "google_service_account" "github_actions" {
  account_id = "github-actions"
}

# BigQuery dataset は外部管理（手動作成）。data source で参照してリネームを fail-fast
data "google_bigquery_dataset" "likes_analytics" {
  dataset_id = "likes_analytics"
}

#
# Service Accounts
#

resource "google_service_account" "scheduler_invoker" {
  account_id   = "scheduler-invoker"
  display_name = "Cloud Scheduler → Workflows invoker"
  description  = "Used by Cloud Scheduler jobs to invoke Workflows executions (minimum privilege)"
}

resource "google_service_account" "likes_export_workflow" {
  account_id   = "likes-export-workflow"
  display_name = "Likes Export Workflow"
  description  = "Runtime SA for likes-export workflow (likes_analytics dataset editor + Firestore viewer + logging writer)"
}

#
# Project-level IAM bindings
#

# Cloud Workflows は provider v7 時点でリソースレベル IAM (google_workflows_workflow_iam_member) を
# サポートしていないため、プロジェクトレベルで付与せざるを得ない。
# 現状プロジェクト内の workflow は likes-export 1本のみで実害なし。
# 将来 workflow が追加されたら scheduler_invoker がそれらも invoke 可能になる点に注意。
resource "google_project_iam_member" "scheduler_invoker_workflows_invoker" {
  project = data.google_project.current.project_id
  role    = "roles/workflows.invoker"
  member  = "serviceAccount:${google_service_account.scheduler_invoker.email}"
}

# data "google_bigquery_dataset" 参照に必要（最小権限: dataset メタデータの read のみ）
resource "google_project_iam_member" "github_actions_bigquery_metadata_viewer" {
  project = data.google_project.current.project_id
  role    = "roles/bigquery.metadataViewer"
  member  = "serviceAccount:${data.google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "likes_export_workflow_datastore_viewer" {
  project = data.google_project.current.project_id
  role    = "roles/datastore.viewer"
  member  = "serviceAccount:${google_service_account.likes_export_workflow.email}"
}

resource "google_project_iam_member" "likes_export_workflow_logging_writer" {
  project = data.google_project.current.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.likes_export_workflow.email}"
}

#
# Resource-level IAM bindings（プロジェクトレベルより狭く最小権限化）
#

resource "google_bigquery_dataset_iam_member" "likes_export_workflow_likes_analytics_editor" {
  project    = data.google_project.current.project_id
  dataset_id = data.google_bigquery_dataset.likes_analytics.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.likes_export_workflow.email}"
}

#
# Service Account-level IAM bindings
#

# Cloud Scheduler の oauth_token に scheduler-invoker SA を設定するため、
# deploy する github-actions SA に scheduler-invoker の actAs 権限が必要。
resource "google_service_account_iam_member" "github_actions_can_actas_scheduler_invoker" {
  service_account_id = google_service_account.scheduler_invoker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${data.google_service_account.github_actions.email}"
}
