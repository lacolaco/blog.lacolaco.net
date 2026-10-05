# terraform-credentials

検索 API (Cloudflare Workers `blog-search`) の CI が使う認証情報を作り、GitHub Actions に登録するモジュール。クラウドをまたぐ連携をコードに残し、後から構成を追えるようにする。

`infra/terraform/` (CI が apply、state は GCS) とは独立している。**apply はローカルだけで行う。state は GCS (`gs://blog-lacolaco-net-tfstate` の prefix `terraform-credentials/state`) に置く。** CI では `fmt` と `validate` (`init -backend=false`) だけを実行し、plan と apply は実行しない。

## 作るもの

| リソース | 内容 |
|---|---|
| `cloudflare_account_token.search_deploy` | デプロイ用の Cloudflare アカウントトークン。権限は後述 |
| `random_password.search_admin_token` | 検索 API の管理用エンドポイントのトークン (48 文字、英数字) |
| `github_actions_secret.cloudflare_api_token` | `lacolaco/blog.lacolaco.net` の secret `CLOUDFLARE_API_TOKEN` |
| `github_actions_secret.search_admin_token` | 同 secret `SEARCH_ADMIN_TOKEN` |
| `github_actions_variable.cloudflare_account_id` | 同 variable `CLOUDFLARE_ACCOUNT_ID` (秘密ではない) |
| `github_actions_variable.image_cdn_base_url` | 同 variable `IMAGE_CDN_BASE_URL` (秘密ではない)。画像 CDN は R2 のカスタムドメインで、バケットとドメインはこの構成の管理外のため、値は入力 `image_cdn_base_url` で与える。既存の variable は `terraform import github_actions_variable.image_cdn_base_url blog.lacolaco.net:IMAGE_CDN_BASE_URL` で取り込む |

### トークンの権限

| permission group | 対象 | 用途 |
|---|---|---|
| Workers Scripts Write | ゾーン lacolaco.net が属するアカウントのみ | Worker スクリプトのデプロイ、Workers Previews の作成と削除、Durable Objects のマイグレーション |
| Workers Routes Write | ゾーン `lacolaco.net` のみ | ルート `blog.lacolaco.net/api/search*` の編集 |

- Durable Objects には専用の permission group がない。Workers Scripts Write の範囲で扱う。
- アカウントトークン (`cloudflare_account_token`) を選んだ理由は、Cloudflare の公式文書が CI/CD のように作成者が離れても動き続けるべき連携にアカウントトークンを勧めているため。`cloudflare_api_token` は作成者個人に紐づく。
- ID は直書きしない。入力はゾーン名 (`zone_name`) と GitHub のリポジトリ名 (`github_repository`) で、`variables.tf` の既定値に置いてある。アカウント ID とゾーン ID は `data.cloudflare_zone` に、permission group の ID は `data.cloudflare_api_token_permission_groups_list` に名前で引かせる。そのため、apply に使う一時トークンには Zone Read も必要になる。

### 未確認事項

Workers Previews の作成と削除、Durable Objects のデプロイが、上記の権限だけで足りるかは未確認である。Cloudflare の文書に明記がなく、検索 API の CI の実デプロイで確かめる。権限が足りなければ `main.tf` の policies に permission group を足す。

### 責務の分担

Worker 側の secret (本番と Preview) への `SEARCH_ADMIN_TOKEN` の反映は、検索 API の CI が GitHub の secret から行う。このモジュールは GitHub の secret を用意するところまでを扱う。

## リポジトリの secret と variable の全件

`lacolaco/blog.lacolaco.net` の Actions secret 12 件と variable 2 件 (`gh secret list`、`gh variable list` で確認、手作業の secret `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_ZONE_ID` の削除後) の管理状況を示す。参照するワークフローは `main` の `.github` を `secrets.<名前>` と `vars.<名前>` で検索した結果である。値は書かない。

### Terraform のコードで追えるもの

| 種別 | 名前 | 管理 | 参照するワークフロー |
|---|---|---|---|
| secret | `CLOUDFLARE_API_TOKEN` | このモジュール | `deploy-production.yml`、`deploy-preview.yml`、`shutdown-preview.yml` |
| secret | `SEARCH_ADMIN_TOKEN` | このモジュール | `deploy-production.yml`、`deploy-preview.yml` |
| variable | `CLOUDFLARE_ACCOUNT_ID` | このモジュール | `deploy-production.yml`、`deploy-preview.yml`、`shutdown-preview.yml` |
| variable | `IMAGE_CDN_BASE_URL` | このモジュール。値は `variables.tf` の `image_cdn_base_url` で与える | `deploy-production.yml`、`deploy-preview.yml` |

### Terraform のコードで追えないもの

いずれも手作業で登録した secret である。外部サービスが発行した認証情報は、Terraform で作る手段がないか、作る対象がこの構成の管理外にある。参照するワークフローが無いものは、Terraform へ取り込まず、別項目で削除を検討する候補とする。再登録は `gh secret set <名前>` で行う。

| 種別 | 名前 | 追えない理由 | 参照するワークフロー |
|---|---|---|---|
| secret | `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code の OAuth トークン。Terraform のリソースにない | `claude.yml`、`ci.yml`、`code-review.yml` |
| secret | `GEMINI_API_KEY` | Gemini の API キー。Terraform のリソースにない | `auto-translate.yml` |
| secret | `WORKER_APP_ID` | GitHub App (アプリ ID) の設定値。アプリはダッシュボードで作る | `auto-translate.yml`、`ci.yml`、`trigger-sync-from-pr-comment.yml` |
| secret | `WORKER_APP_PRIVATE_KEY` | 同アプリの秘密鍵。ダッシュボードで発行する | 同上 |
| secret | `NOTION_AUTH_TOKEN` | Notion のインテグレーションのトークン | 参照なし |
| secret | `NOTION_DATABASE_ID` | 秘密でない ID。どのワークフローも参照せず、取り込まずに削除を検討する候補 | 参照なし |
| secret | `ANTHROPIC_API_KEY` | Anthropic の API キー | 参照なし |
| secret | `R2_ACCESS_KEY_ID` | Cloudflare R2 の API トークンから得るキー | 参照なし |
| secret | `R2_SECRET_ACCESS_KEY` | 同上 | 参照なし |
| secret | `R2_BUCKET_NAME` | 秘密でないバケット名。どのワークフローも参照せず、取り込まずに削除を検討する候補 | 参照なし |

- `R2_*` と `NOTION_*` は `tools/` のローカル実行 (`tools/env.d.ts`、`.env.example`) が環境変数で読むが、`main` のワークフローは参照しない。
- `NOTION_AUTH_TOKEN`、`ANTHROPIC_API_KEY`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` も参照するワークフローが無く、削除を別項目で検討する。

## 有効期限とローテーション

デプロイ用トークンの有効期限は、`time_rotating.search_deploy_token` の基準時刻から 1 年である。固定の日付は持たない。

- `time_rotating` は作成から 300 日で期限に達し、その後の最初の `plan` で置き換えが提案される。`replace_triggered_by` により、トークンも同時に作り直されて新しい期限と値を得る。GitHub の secret も新しい値に更新される。
- 有効期限 (365 日) の 65 日前から置き換えが提案されるので、その間に `terraform apply` を実行する。期限を過ぎると検索 API のデプロイが止まる。
- 手動で今すぐ更新するときは次を実行する。

```bash
terraform apply -replace=time_rotating.search_deploy_token
```

`SEARCH_ADMIN_TOKEN` を更新するときは次を実行し、そのあと検索 API の CI を再実行して Worker 側の secret へ反映する。

```bash
terraform apply -replace=random_password.search_admin_token
```

## apply の手順

ローカル実行に必要な認証情報は、値をファイルに置かず環境変数で渡す。

### GitHub

リポジトリの secret と variable を書ける認証情報を `GITHUB_TOKEN` に渡す。`gh` にログイン済みなら次でよい (`repo` スコープが必要)。

```bash
export GITHUB_TOKEN="$(gh auth token)"
```

### Cloudflare

トークンを作るには、トークン作成権限を持つ認証情報が必要になる。`cf auth login` の OAuth トークンにはその権限がなく、`/accounts/<id>/tokens` が 403 を返す。次の一時トークンをダッシュボードで作り、`CLOUDFLARE_API_TOKEN` に渡す。

1. ダッシュボードの「アカウントのAPIトークン」でカスタムトークンを作る。
2. 権限は Account API Tokens Write (アカウント) に加え、Zone Read (ゾーン lacolaco.net)、Workers Scripts Write (アカウント)、Workers Routes Write (ゾーン lacolaco.net) を付ける。アカウントトークンは作成者に付与された権限の部分集合しか付与できないため、付与する権限も必要になる。
3. 有効期限は短く (数時間) 設定し、apply 後に削除する。

```bash
read -rs CLOUDFLARE_API_TOKEN && export CLOUDFLARE_API_TOKEN
```

### 実行

```bash
cd infra/terraform-credentials
terraform init
terraform plan
terraform apply
```

トークンの値は出力しない。`terraform output` にも出していない。

## state の扱い

- state は GCS の `gs://blog-lacolaco-net-tfstate` の prefix `terraform-credentials/state` に置く。トークンの値が平文で入るため、手元のディスクにもコミットにも置かない。GCS の backend では、Terraform は実行中だけ state をメモリに持つ。
- bucket は均一なバケットレベルのアクセスで、読めるのはプロジェクトのオーナー、編集者、閲覧者と、`storage.admin` を持つ CI のサービスアカウントである。CI は GitHub の secret から同じトークンを直接使えるため、state を GCS に置いても読める範囲は広がらない。
- 認証は gcloud の ADC (`gcloud auth application-default login`) で行う。
- bucket のオブジェクトのバージョニングで過去の state が残る場合は、トークンを作り直したあとも古い値が残る。

### state を紛失したとき

- `cloudflare_account_token` は `terraform import cloudflare_account_token.search_deploy '<account_id>/<token_id>'` で取り込める。ただし `value` は取り込まれない (公式文書の記述)。そのため取り込んだあと `terraform apply -replace=time_rotating.search_deploy_token` で作り直し、GitHub secret を更新する。
- 古いトークンは `cf accounts tokens delete <token-id>` で削除する。ダッシュボードでも削除できる。
- `random_password` は import できない。再生成して `SEARCH_ADMIN_TOKEN` を更新する。
- GitHub の secret と variable は同名のものが既にあると apply が失敗する場合がある。そのときは `terraform import` で取り込むか、先に削除する。
