# terraform-credentials

検索 API (Cloudflare Workers `blog-search`) の CI が使う認証情報を作り、GitHub Actions に登録するモジュール。クラウドをまたぐ連携をコードに残し、後から構成を追えるようにする。

`infra/terraform/` (CI が apply、state は GCS) とは独立している。**apply はローカルだけで行い、state もローカルに置く。** CI では `fmt` と `validate` (`init -backend=false`) だけを実行し、plan と apply は実行しない。

## 作るもの

| リソース | 内容 |
|---|---|
| `cloudflare_account_token.search_deploy` | デプロイ用の Cloudflare アカウントトークン。権限は後述 |
| `random_password.search_admin_token` | 検索 API の管理用エンドポイントのトークン (48 文字、英数字) |
| `github_actions_secret.cloudflare_api_token` | `lacolaco/blog.lacolaco.net` の secret `CLOUDFLARE_API_TOKEN` |
| `github_actions_secret.search_admin_token` | 同 secret `SEARCH_ADMIN_TOKEN` |
| `github_actions_variable.cloudflare_account_id` | 同 variable `CLOUDFLARE_ACCOUNT_ID` (秘密ではない) |

### トークンの権限

| permission group | 対象 | 用途 |
|---|---|---|
| Workers Scripts Write | アカウント `1b603c7fcf83d8b1d0306c84390c854b` のみ | Worker スクリプトのデプロイ、Workers Previews の作成と削除、Durable Objects のマイグレーション |
| Workers Routes Write | ゾーン `lacolaco.net` のみ | ルート `blog.lacolaco.net/api/search*` の編集 |

- Durable Objects には専用の permission group がない。Workers Scripts Write の範囲で扱う。
- アカウントトークン (`cloudflare_account_token`) を選んだ理由は、Cloudflare の公式文書が CI/CD のように作成者が離れても動き続けるべき連携にアカウントトークンを勧めているため。`cloudflare_api_token` は作成者個人に紐づく。
- permission group の ID は `cf user tokens permission-groups list` で取得できる。

### 未確認事項

Workers Previews の作成と削除、Durable Objects のデプロイが、上記の権限だけで足りるかは未確認である。Cloudflare の文書に明記がなく、検索 API の CI の実デプロイで確かめる。権限が足りなければ `main.tf` の policies に permission group を足す。

### 責務の分担

Worker 側の secret (本番と Preview) への `SEARCH_ADMIN_TOKEN` の反映は、検索 API の CI が GitHub の secret から行う。このモジュールは GitHub の secret を用意するところまでを扱う。

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
2. 権限は Account API Tokens Write (アカウント) に加え、Workers Scripts Write (アカウント) と Workers Routes Write (ゾーン lacolaco.net) を付ける。アカウントトークンは作成者に付与された権限の部分集合しか付与できないため、付与する権限も必要になる。
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

- state はローカル (`terraform.tfstate`) に置く。トークンの値が平文で入るため、リモート backend にもコミットにも載せない。`.gitignore` の `*.tfstate` `*.tfstate.*` と `**/.terraform/` で除外される。確認方法は `git check-ignore -v infra/terraform-credentials/terraform.tfstate`。
- バックアップは、パスワードマネージャーなど暗号化された保管先に置くことを勧める。ただし必須ではない。失っても次のとおり戻せる。

### state を紛失したとき

- `cloudflare_account_token` は `terraform import cloudflare_account_token.search_deploy '<account_id>/<token_id>'` で取り込める。ただし `value` は取り込まれない (公式文書の記述)。そのため取り込んだあと `terraform apply -replace=time_rotating.search_deploy_token` で作り直し、GitHub secret を更新する。
- 古いトークンは `cf accounts tokens delete <token-id>` で削除する。ダッシュボードでも削除できる。
- `random_password` は import できない。再生成して `SEARCH_ADMIN_TOKEN` を更新する。
- GitHub の secret と variable は同名のものが既にあると apply が失敗する場合がある。そのときは `terraform import` で取り込むか、先に削除する。
