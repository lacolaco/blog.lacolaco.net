# GitHub リポジトリ設定の Terraform

GitHub の管理者権限を要する設定をコード化する。`infra/terraform` (CI が GCP の認証で apply する) とは分け、
**ローカルで apply する**。リポジトリの設定を変更できる権限を CI に置かないためである。

## 管理対象

| リソース                                        | 内容                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `github_repository_ruleset.require_code_review` | `code-review-gate` (`.github/workflows/code-review.yml`) を main への必須チェックにする |

既存の ruleset (main: build, test) とブランチ保護には触れない。ruleset は重ねて評価される。

## apply の手順

```bash
cd infra/terraform-github
export GITHUB_TOKEN=$(gh auth token)   # 値は表示しない
mise exec terraform@1.14.9 -- terraform init
mise exec terraform@1.14.9 -- terraform plan
mise exec terraform@1.14.9 -- terraform apply
```

state は `gs://blog-lacolaco-net-tfstate` の prefix `terraform-github/state` に置く (gcloud の ADC で認証)。

## 適用の順序

`code-review.yml` を main に取り込む PR のマージ前に apply する。詳細はその PR の説明を参照する。
