resource "google_workflows_workflow" "likes_export" {
  name            = "likes-export"
  region          = "asia-northeast1"
  source_contents = file("${path.module}/../workflows/likes-export.yaml")
  # TODO(Phase 4): SA自体をTerraform管理に取り込んだら google_service_account.likes_export_workflow.email に変更
  service_account = "projects/blog-lacolaco-net/serviceAccounts/likes-export-workflow@blog-lacolaco-net.iam.gserviceaccount.com"
}
