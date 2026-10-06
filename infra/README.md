# インフラ構成

## Terraform モジュール

- `infra/terraform/`: GCP のリソース。CI が apply する (`infra/terraform/README.md`)。
- `infra/terraform-credentials/`: 検索 API の CI が使う Cloudflare のトークンと GitHub Actions の secret、検索ログの Logpush ジョブ。ローカルだけで apply する (`infra/terraform-credentials/README.md`)。

## 検索ログの経路

本番の検索 API (Worker `blog-search`) が出す検索語を、BigQuery で分析できるようにする経路。

```
Worker blog-search (console.log の JSON 1 行、wrangler.jsonc の logpush: true)
  → Logpush ジョブ (Cloudflare、データセット workers_trace_events、ScriptName = blog-search) [約 1 分間隔]
    → GCS gs://blog-lacolaco-net-search-logs/workers/<日付>/*.log.gz (NDJSON、gzip)
      → BigQuery 外部表 search_analytics.search_logs_raw
        → ビュー search_analytics.search_events (検索イベントだけ。1 検索 1 行)
```

| 資源 | 管理 |
|---|---|
| GCS バケット、Logpush の書き込み元への権限、外部表、ビュー | `infra/terraform/search_logs.tf` (CI が apply) |
| Logpush ジョブ、所有権の確認 | `infra/terraform-credentials/logpush.tf` (ローカルで apply) |
| Worker の `logpush: true` | `tools/search-worker/wrangler.jsonc` (CI がデプロイ) |

### ビューの列

| 列 | 内容 |
|---|---|
| `searched_at` | 検索の時刻 (TIMESTAMP) |
| `q` | 検索語 |
| `locale` | `ja` または `en` |
| `hits` | API が返した件数。上限 20 で、総数ではない |
| `ms` | Worker 内の所要時間 (ミリ秒) |

- Logpush のフィルターは `Logs` (array) を条件に使えないため、生データ (`search_logs_raw`) には管理用エンドポイントの呼び出しや平文のログも入る。検索のイベントだけを選ぶのは `search_events` の SQL (`infra/terraform/search_events.sql.tftpl`) である。分析には `search_events` を使う。
- SQL の仕様は `infra/terraform/tests/search_events.test.sh` が固定の入力行で確かめる。BigQuery の認証が要るため CI では実行しない。SQL を変えたらローカルで実行する。
- データセット `search_analytics` は検索ログ専用である (`likes_analytics` に混ぜると名前と中身が合わない)。CI のサービスアカウント (`github-actions`) はデータセットを作る権限 (`bigquery.datasets.create`) を持たず、その権限をプロジェクト全体へ広げないため、データセットとその IAM は初回だけ権限のある利用者が `infra/terraform` をローカルで apply して作った。作成後は CI の apply に差分が出ない。データセットを作り直すときも同じ手順で行う。
- 検索語のマスクと保持期間の制限は設けない (個人情報を含む語が検索される見込みが無いというプロダクトオーナーの判断、2026-10-06)。バケットに削除のルールは無く、生データは残り続ける。個人情報が含まれると分かったら、`search_logs.tf` のバケットに `lifecycle_rule` を足す。
- 外部表を読むには、問い合わせる主体がバケットの読み取り権限 (`storage.objects.get`) も要る。`lacolaco-dwh` など別プロジェクトからビュー経由で読むときは、読む側にこの権限を与える (承認済みビューはデータセットの権限だけを移す)。

### 権限

| 主体 | 権限 | 理由 |
|---|---|---|
| `logpush@cloudflare-data.iam.gserviceaccount.com` (Cloudflare 共有) | バケットの `roles/storage.objectAdmin` | Logpush の書き込みと所有権の確認ファイルの読み書き (公式文書の指定)。鍵は発行しない |
| `github-actions` (CI) | 既存の `storage.admin` と、`search_analytics` に限った `bigquery.dataOwner` | バケットの作成と、外部表・ビューの管理。プロジェクト全体の権限は広げない |
| ジョブを作る Cloudflare のトークン (一時) | アカウントの Logs Write | `infra/terraform-credentials/README.md` を参照 |

長期の認証情報 (JSON 鍵やトークン) は経路に無いため、ローテーションの対象は無い。

### 止まったときに気づく手段

経路が止まる原因は、Logpush ジョブの停止 (送り先への書き込みが続けて失敗すると Cloudflare がジョブを止める)、バケットへの権限が外れること、Worker の `logpush` の解除である。検索 API は影響を受けず、検索語だけが届かなくなる。次を確かめる。

1. 最新の検索の時刻 (数日検索が無いと止まって見えるため、本番の検索 API に固有の語で 1 回問い合わせてから、約 2 分後に確かめる)。

   ```bash
   bq query --nouse_legacy_sql --maximum_bytes_billed=1000000000 \
     'SELECT MAX(searched_at) AS latest FROM `blog-lacolaco-net.search_analytics.search_events`'
   ```

2. Logpush ジョブの状態。`enabled` が `true` で、`last_error` と `error_message` が `null` であること。

   ```bash
   CLOUDFLARE_ACCOUNT_ID=<ゾーン lacolaco.net のアカウント ID> cf logpush account-jobs list
   ```

3. 停止していたら、権限 (`gcloud storage buckets get-iam-policy gs://blog-lacolaco-net-search-logs`) を確かめて直し、`terraform -chdir=infra/terraform-credentials apply` でジョブを `enabled = true` に戻す。ジョブを作り直した直後は、数分間のイベントが届かないことがある。
4. Cloudflare のダッシュボードの「通知」で、Logpush のジョブの失敗 (Logpush Failed Job) の通知を有効にすると、ジョブの停止をメールで受け取れる。通知の設定はこの構成の管理外である。

## Likes BIダッシュボード

### 構成

```
Firestore (likes-production)
  → Cloud Workflows (likes-export) [日次 AM 3:00 JST]
    → BigQuery (likes_analytics.post_likes_snapshot)

GA4 (G-0BEKSBSM5X, property: 266351853)
  → BigQuery (analytics_266351853) [日次エクスポート]

BigQuery
  → Looker Studio ダッシュボード
```

### BigQueryリソース

| データセット | テーブル | 説明 |
|---|---|---|
| `likes_analytics` | `post_likes_snapshot` | 日次のslug別いいね数スナップショット |
| `analytics_266351853` | `events_*` | GA4日次エクスポート（PV等） |

### Cloud Workflows

- **likes-export** (`infra/workflows/likes-export.yaml`)
  - Firestore `post_likes`コレクション全件取得→BigQuery挿入
  - サービスアカウント: `likes-export-workflow@blog-lacolaco-net.iam.gserviceaccount.com`（datastore.viewer + bigquery.dataEditor + logging.logWriter）
  - Terraform 管理下（`infra/terraform/workflow.tf`）。YAML本体は `infra/workflows/likes-export.yaml` を `file()` で参照

### Cloud Scheduler

- **likes-export-daily**: `0 3 * * * Asia/Tokyo`
  - likes-exportワークフローを日次実行
  - Terraform 管理下（`infra/terraform/scheduler.tf`）

### Looker Studioダッシュボード構築手順

1. [Looker Studio](https://lookerstudio.google.com/) にアクセス
2. 「空のレポート」を作成
3. データソースを追加:
   - 「BigQuery」→ プロジェクト `blog-lacolaco-net`
   - **いいねデータ**: `likes_analytics.post_likes_snapshot`
   - **PVデータ**: `analytics_266351853.events_*`
4. 推奨ウィジェット:

#### 記事別いいね数（テーブル）
- データソース: `post_likes_snapshot`
- ディメンション: `slug`
- 指標: `like_count` (MAX)
- フィルタ: `DATE(snapshot_at, 'Asia/Tokyo')` = 最新日

#### いいね数推移（時系列グラフ）
- データソース: `post_likes_snapshot`
- ディメンション: `DATE(snapshot_at, 'Asia/Tokyo')`
- 指標: `like_count` (SUM)
- 内訳: `slug`

#### PV×いいね相関（カスタムクエリ）
BigQueryのカスタムクエリをデータソースとして使用:
```sql
WITH latest_likes AS (
  SELECT slug, like_count
  FROM `blog-lacolaco-net.likes_analytics.post_likes_snapshot`
  WHERE DATE(snapshot_at, 'Asia/Tokyo') = (SELECT MAX(DATE(snapshot_at, 'Asia/Tokyo')) FROM `blog-lacolaco-net.likes_analytics.post_likes_snapshot`)
),
page_views AS (
  SELECT
    REGEXP_EXTRACT(
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'),
      r'/posts/([^/?#]+)'
    ) AS slug,
    COUNT(*) AS pv_count
  FROM `blog-lacolaco-net.analytics_266351853.events_*`
  WHERE event_name = 'page_view'
    AND _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
  GROUP BY slug
)
SELECT
  COALESCE(l.slug, p.slug) AS slug,
  IFNULL(l.like_count, 0) AS like_count,
  IFNULL(p.pv_count, 0) AS pv_30d
FROM latest_likes l
FULL OUTER JOIN page_views p ON l.slug = p.slug
ORDER BY pv_30d DESC
```

### 運用

- **手動実行**: `gcloud workflows run likes-export --location=asia-northeast1 --project=blog-lacolaco-net`
- **ログ確認**: `gcloud workflows executions list likes-export --location=asia-northeast1 --project=blog-lacolaco-net --limit=5`
- **失敗アラート**: Cloud Monitoring → Alerting で `workflow.googleapis.com/finished_execution_count` のstatus=FAILEDに通知を設定すること。ページネーション超過やAPI障害時にワークフローがFAILEDになるため、無音で失敗しないようにする

### 注意事項

- **insertId**: BigQuery streaming insertのdeduplicationはbest-effort。数分以上間隔の再実行では重複しうる。集計クエリでは`MAX(like_count)`を使用し重複の影響を軽減する
- **ページネーション**: 投稿数5000超過でワークフローがFAILED。その場合はページネーションループの実装が必要
- **ワークフロー状態上限**: Cloud Workflowsの状態上限は512KB。BigQuery insertは100件バッチで分割済みだが、Firestore listレスポンス（list_response.body.documents）が512KBを超える場合はクラッシュする。その場合はページネーションループの実装が必要
