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

このSAは Phase 1 bootstrap時に gcloud で作成され、IAM binding も gcloud で設定済み。
将来 Phase 4 で Terraform 管理に取り込む予定。

## 拡張予定（別 phase）

- Phase 4: IAM binding + SA の Terraform 化
