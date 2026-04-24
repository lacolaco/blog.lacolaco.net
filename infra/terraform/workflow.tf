resource "google_workflows_workflow" "likes_export" {
  name            = "likes-export"
  region          = "asia-northeast1"
  source_contents = file("${path.module}/../workflows/likes-export.yaml")
  service_account = google_service_account.likes_export_workflow.email
}
