# インフラ構成

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
