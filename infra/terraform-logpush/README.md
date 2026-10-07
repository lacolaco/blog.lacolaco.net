# terraform-logpush

検索 API (Cloudflare Workers `blog-search`) の Workers Trace Events を GCS へ送る Logpush ジョブを作るモジュール。経路の全体は `infra/README.md` の「検索ログの経路」を参照。送り先のバケットと権限は `infra/terraform` (CI が apply) が作り、このモジュールは Cloudflare 側のジョブだけを作る。

**apply はローカルだけで行う。state は GCS (`gs://blog-lacolaco-net-tfstate` の prefix `terraform-logpush/state`) に置く。** CI では `fmt` と `validate` (`init -backend=false`) だけを実行し、plan と apply は実行しない。

## 作るもの

| リソース | 内容 |
|---|---|
| `terraform_data.logpush_job` | Logpush ジョブ `blog-search-workers-trace-events` (データセット `workers_trace_events`、フィルター `ScriptName = blog-search`、NDJSON)。作成と削除は `scripts/` の `cf` CLI で行う |
| `data.external.account` | ゾーン名 (`lacolaco.net`) からアカウント ID を引く。ID は直書きしない |
| `data.external.job` | 実在のジョブの状態 (存在、`enabled`、直近のエラー) を plan で読む |
| `check.job_status` | ジョブが無い、止まっている、エラーがあるときに plan で警告を出す |

## cloudflare プロバイダーを使わない理由

Cloudflare のプロバイダーは API トークンしか受け付けない。Logpush のジョブを作るトークンは Logs の編集権限が要り、そのトークンを Terraform で作るには、トークン作成の権限 (Account API Tokens Write) を持つ別のトークンが要る。ダッシュボードで一時トークンを作る手作業が残るため、これを避けた。

`cf` CLI は `cf auth login` でログイン済みの OAuth の認証情報を自分で使う。トークンの値を Terraform や環境変数に渡さず、ファイルにも出力にも残さない。そのため、Cloudflare 側の操作は `terraform_data` の `local-exec` から `cf` を呼ぶ。

- 所有権の確認: `cf logpush account-ownership create` が確認ファイルをバケットに書き、`gcloud storage cat` で読んでジョブの `ownership_challenge` に渡す。手作業でトークンを写さない。
- 冪等: 同名のジョブが既にあれば作らない。削除も、無ければ何もしない。
- ジョブの定義 (名前、データセット、送り先、フィルター、`output_options`) は `triggers_replace` に入れる。変えると、ジョブを削除して作り直す。ジョブ名は `^[a-zA-Z0-9._-]*$` に限られる (空白は API が 400 で拒否する)。

## 制約

- プロバイダーのリソースと違い、Cloudflare 側の直接の変更 (ダッシュボードでの停止や削除、フィルターの書き換え) は、plan で差分として検出されない。`data.external.job` と `check` が、ジョブの不在・停止・エラーを警告で示すだけである。直すには `terraform apply -replace=terraform_data.logpush_job` を実行する。フィルターなどの中身の食い違いは検出できないため、`cf logpush account-jobs list` で確かめる。
- ジョブを作り直した直後は、数分間のイベントが届かないことがある。
- `cf` と `python3` と `gcloud` が実行環境に要る。

## apply の手順

1. `cf auth login` でログイン済みであること。ゾーン `lacolaco.net` が属するアカウントを使う。アカウントはゾーン名から自動で選ぶので、`CLOUDFLARE_ACCOUNT_ID` は設定しない。ログインしたアカウントが複数のアカウントのメンバーでも、スクリプトはゾーンの属するアカウントを指定して `cf` を呼ぶ。
2. `gcloud auth application-default login` で GCP の認証を済ませる (バケットの参照と state の読み書きに使う)。
3. `infra/terraform` が反映済みで、バケット `blog-lacolaco-net-search-logs` があること (無いと plan が失敗する)。

```bash
cd infra/terraform-logpush
terraform init
terraform plan
terraform apply
```

apply 後に再度 `plan` して、差分が無く `check` の警告も出ないことを確かめる。

## state の扱い

- state には秘密が入らない (ジョブの定義と ID だけ)。それでも GCS の backend に置き、手元のディスクにもコミットにも置かない。
- state を紛失したときは、同名のジョブが既にあれば作成スクリプトが何もしないので、`terraform apply` で state にだけ `terraform_data` が戻る。ジョブの中身を作り直したいときは、`cf logpush account-jobs delete <job-id> --force` で削除してから apply する。
- `terraform destroy` は `delete-job.sh` を実行し、同名のジョブを削除する。
