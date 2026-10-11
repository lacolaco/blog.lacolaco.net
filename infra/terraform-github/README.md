# GitHub リポジトリ設定の Terraform

GitHub の管理者権限を要する設定をコード化する。`infra/terraform` (CI が GCP の認証で apply する) とは分け、
**ローカルで apply する**。リポジトリの設定を変更できる権限を CI に置かないためである。

## 管理対象

| リソース                                        | 内容                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `github_repository_ruleset.require_code_review` | `code-review-gate` (`.github/workflows/code-review.yml`) を main への必須チェックにする |
| `github_repository_dependabot_security_updates.blog` | Dependabot security updates を無効にする (`enabled = false`)。依存の更新は Renovate に一本化する |

既存の ruleset (main: build, test) とブランチ保護には触れない。ruleset は重ねて評価される。

## 依存の更新の一本化

依存の更新の PR は Renovate (`.github/renovate.json`) だけが作る。Dependabot security updates は、同じ更新の PR を
Dependabot も作り、その PR は `code-review-gate` と deploy が通らずマージできないまま残るため、無効にする。
バージョンの更新 (version updates) は `.github/dependabot.yml` が無いので動いていない。

**Dependabot alerts は有効のまま残し、Terraform の管理にも入れない。** Renovate は脆弱性の PR (`[security]`) の
情報源に Dependabot alerts を使うので、alerts を止めると脆弱性の更新 PR が出なくなる。
リポジトリ全体を表す `github_repository` も、取り込み時の記述の差で既存設定を意図せず変えないよう管理に入れない。

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

apply してから `code-review.yml` が main に入るまでの間、オープン中のすべての PR は `code-review-gate` が報告されず、マージできない。`code-review.yml` が main に入ったあとも、既存の PR は push するか main に追従してワークフローを再実行するまで `code-review-gate` を待ち続ける。
