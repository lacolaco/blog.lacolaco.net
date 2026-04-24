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
}

#
# Project-level IAM bindings
#

resource "google_project_iam_member" "scheduler_invoker_workflows_invoker" {
  project = "blog-lacolaco-net"
  role    = "roles/workflows.invoker"
  member  = "serviceAccount:${google_service_account.scheduler_invoker.email}"
}

resource "google_project_iam_member" "likes_export_workflow_bigquery_data_editor" {
  project = "blog-lacolaco-net"
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.likes_export_workflow.email}"
}

resource "google_project_iam_member" "likes_export_workflow_datastore_viewer" {
  project = "blog-lacolaco-net"
  role    = "roles/datastore.viewer"
  member  = "serviceAccount:${google_service_account.likes_export_workflow.email}"
}

resource "google_project_iam_member" "likes_export_workflow_logging_writer" {
  project = "blog-lacolaco-net"
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.likes_export_workflow.email}"
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
