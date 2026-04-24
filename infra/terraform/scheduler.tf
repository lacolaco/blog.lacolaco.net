resource "google_cloud_scheduler_job" "likes_export_daily" {
  name   = "likes-export-daily"
  region = "asia-northeast1"

  schedule         = "0 3 * * *"
  time_zone        = "Asia/Tokyo"
  attempt_deadline = "180s"

  # リトライは意図的に無効化（冪等性担保のため、失敗時は手動調査）
  retry_config {
    retry_count        = 0
    max_retry_duration = "0s"
  }

  http_target {
    http_method = "POST"
    uri         = "https://workflowexecutions.googleapis.com/v1/projects/blog-lacolaco-net/locations/asia-northeast1/workflows/likes-export/executions"
    body        = base64encode("{}")

    oauth_token {
      service_account_email = "scheduler-invoker@blog-lacolaco-net.iam.gserviceaccount.com"
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
}
