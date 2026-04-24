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

## 手動 apply 手順

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

## 拡張予定（別 phase）

- Phase 2: GHA への terraform apply 組み込み（`infra/terraform/**` 変更時のみ）
- Phase 3: Cloud Workflow (`likes-export`) の Terraform 化
- Phase 4: IAM binding の Terraform 化
