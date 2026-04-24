resource "google_workflows_workflow" "likes_export" {
  name            = "likes-export"
  region          = "asia-northeast1"
  source_contents = file("${path.module}/../workflows/likes-export.yaml")
  # state は full resource name 形式で保存されるため .name（= projects/.../serviceAccounts/...@...）を使う。
  # scheduler.tf は .email だが、oauth_token.service_account_email は email のみを受け付けるフィールド。
  service_account = google_service_account.likes_export_workflow.name
}
