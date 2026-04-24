# Terraform 管理リソース

Phase 1 の最小構成: Cloud Scheduler のみ。

## Prerequisites

- Terraform 1.14+
- `gcloud auth application-default login` で認証済み
- tfstate bucket: `gs://blog-lacolaco-net-tfstate` (versioning ON)

## 管理対象

| リソース | 定義ファイル |
|---|---|
| `google_cloud_scheduler_job.likes_export_daily` | `scheduler.tf` |
| `google_workflows_workflow.likes_export` | `workflow.tf` |
| `google_service_account.scheduler_invoker` | `iam.tf` |
| `google_service_account.likes_export_workflow` | `iam.tf` |
| `google_project_iam_member.*` (4件) | `iam.tf` |
| `google_service_account_iam_member.github_actions_can_actas_scheduler_invoker` | `iam.tf` |

## Apply 方法

通常は `main` ブランチへの merge で `deploy-production.yml` 内の
Terraform Apply ステップが自動実行される（`infra/terraform/**` 変更時のみ）。

ローカルから手動 apply する場合:

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

## 既存リソースの import（初期セットアップ済）

```bash
terraform import \
  google_cloud_scheduler_job.likes_export_daily \
  projects/blog-lacolaco-net/locations/asia-northeast1/jobs/likes-export-daily
```

## Cloud Scheduler の oauth_token SA

`scheduler-invoker@blog-lacolaco-net.iam.gserviceaccount.com` （`roles/workflows.invoker` のみ保有する専用 SA）を使用。
Phase 4 で Terraform 管理下に移行済み（`iam.tf`）。

## 拡張予定

現時点では全てのリソースが Terraform 管理下。次の候補:

- Cloud Run サービス定義
- BigQuery データセット/テーブルスキーマ
- GA4 → BigQuery エクスポート設定
- Workload Identity プール/プロバイダ
