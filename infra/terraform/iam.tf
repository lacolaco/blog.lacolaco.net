#
# Project reference (for IAM member bindings)
#

data "google_project" "current" {}

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

resource "google_project_iam_member" "scheduler_invoker_workflows_invoker" {
  project = data.google_project.current.project_id
  role    = "roles/workflows.invoker"
  member  = "serviceAccount:${google_service_account.scheduler_invoker.email}"
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
# Dataset-level IAM bindings (BigQuery)
# プロジェクトレベルではなく likes_analytics dataset スコープで最小権限化
#

resource "google_bigquery_dataset_iam_member" "likes_export_workflow_likes_analytics_editor" {
  dataset_id = "likes_analytics"
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.likes_export_workflow.email}"
}

#
# Service Account-level IAM bindings
#

# Cloud Scheduler の oauth_token に scheduler-invoker SA を設定するため、
# deploy する github-actions SA に scheduler-invoker の actAs 権限が必要
resource "google_service_account_iam_member" "github_actions_can_actas_scheduler_invoker" {
  service_account_id = google_service_account.scheduler_invoker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:github-actions@blog-lacolaco-net.iam.gserviceaccount.com"
}
