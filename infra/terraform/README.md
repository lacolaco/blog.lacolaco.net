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
| `google_project_iam_member.*` (3件) | `iam.tf` |
| `google_bigquery_dataset_iam_member.*` (2件) | `iam.tf` |
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

**運用上の注意**: IAM binding の変更（特に BigQuery dataset-level ⇄
project-level のスコープ変更）を伴う apply は、create-then-destroy の順で
実行されても一時的な権限ギャップが生じうる。likes-export workflow の実行は
毎日 03:00 JST（18:00 UTC）なので、apply はそれ以外の時間帯に行うこと。

## 既存リソースの import（初期セットアップ済）

```bash
# Phase 1
terraform import \
  google_cloud_scheduler_job.likes_export_daily \
  projects/blog-lacolaco-net/locations/asia-northeast1/jobs/likes-export-daily

# Phase 4: Service Accounts
terraform import \
  google_service_account.scheduler_invoker \
  projects/blog-lacolaco-net/serviceAccounts/scheduler-invoker@blog-lacolaco-net.iam.gserviceaccount.com

terraform import \
  google_service_account.likes_export_workflow \
  projects/blog-lacolaco-net/serviceAccounts/likes-export-workflow@blog-lacolaco-net.iam.gserviceaccount.com

# Phase 4: Project IAM bindings
terraform import \
  google_project_iam_member.scheduler_invoker_workflows_invoker \
  'blog-lacolaco-net roles/workflows.invoker serviceAccount:scheduler-invoker@blog-lacolaco-net.iam.gserviceaccount.com'

terraform import \
  google_project_iam_member.likes_export_workflow_datastore_viewer \
  'blog-lacolaco-net roles/datastore.viewer serviceAccount:likes-export-workflow@blog-lacolaco-net.iam.gserviceaccount.com'

terraform import \
  google_project_iam_member.likes_export_workflow_logging_writer \
  'blog-lacolaco-net roles/logging.logWriter serviceAccount:likes-export-workflow@blog-lacolaco-net.iam.gserviceaccount.com'

# Phase 4: SA-level IAM binding
terraform import \
  google_service_account_iam_member.github_actions_can_actas_scheduler_invoker \
  'projects/blog-lacolaco-net/serviceAccounts/scheduler-invoker@blog-lacolaco-net.iam.gserviceaccount.com roles/iam.serviceAccountUser serviceAccount:github-actions@blog-lacolaco-net.iam.gserviceaccount.com'

# Phase 3 注: google_workflows_workflow は provider v7 時点で import 非対応のため、
# gcloud workflows delete → terraform apply で移行した。

# Phase 4 注: google_bigquery_dataset_iam_member 2件 は今PRで新規作成のため import 不要。
#   - likes_export_workflow_likes_analytics_editor
#   - github_actions_likes_analytics_metadata_viewer
#
# これらに対応する旧 project-level の google_project_iam_member 2件
# (likes_export_workflow_bigquery_data_editor, github_actions_bigquery_metadata_viewer) は、
# 事前に terraform import で state に取り込んだ上で tf ファイルから削除している。
# よって apply 実行で Terraform が GCP 側の旧 binding を destroy する。
# 旧 binding の手動 gcloud 削除は不要。
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
