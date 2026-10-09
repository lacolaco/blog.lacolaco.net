# インフラ構成

## Terraform モジュール

- `infra/terraform/`: GCP のリソース。CI が apply する (`infra/terraform/README.md`)。
- `infra/terraform-credentials/`: 検索 API の CI が使う Cloudflare のトークンと GitHub Actions の secret。ローカルだけで apply する (`infra/terraform-credentials/README.md`)。
- `infra/terraform-logpush/`: 検索ログの Logpush ジョブ。トークンを持たず、ログイン済みの `cf` CLI でローカルだけで apply する (`infra/terraform-logpush/README.md`)。

## 検索ログの経路

本番の検索 API (Worker `blog-search`) が出す検索語を、BigQuery で分析できるようにする経路。

```
Worker blog-search (console.log の JSON 1 行、wrangler.jsonc の logpush: true)
  → Logpush ジョブ (Cloudflare、データセット workers_trace_events、ScriptName = blog-search) [約 1 分間隔]
    → GCS gs://blog-lacolaco-net-search-logs/workers/<日付>/*.log.gz (NDJSON、gzip)
      → BigQuery 外部表 blog_analytics.search_logs_raw
        → ビュー blog_analytics.search_events (検索イベントだけ。1 検索 1 行)
        → ビュー blog_analytics.search_log_quality (search_events に入らなかった呼び出しの件数。取りこぼしの割合用)
```

| 資源 | 管理 |
|---|---|
| GCS バケット、Logpush の書き込み元への権限、外部表、ビュー | `infra/terraform/search_logs.tf` (CI が apply) |
| Logpush ジョブ、所有権の確認 | `infra/terraform-logpush/` (ローカルで apply) |
| Worker の `logpush: true` | `tools/search-worker/wrangler.jsonc` (CI がデプロイ) |

### ビューの列

| 列 | 内容 |
|---|---|
| `searched_at` | 検索の時刻 (TIMESTAMP) |
| `q` | 検索語 |
| `locale` | `ja` または `en` |
| `hits` | API が返した件数。上限 20 で、総数ではない |
| `ms` | Worker 内の所要時間 (ミリ秒) |
| `log_date` | 読んだファイルの経路 `workers/<YYYYMMDD>/` の日付 (STRING、例 `'20261007'`)。Logpush が決める UTC の日付で、JST ではない。`searched_at` の日付とは、JST の 0 時から 9 時の検索で一致しない。想定外の経路のファイルでは NULL |

### 日付で絞って読む

外部表は問い合わせのたびに GCS のファイルを読み、保持期間も設けないため、日付を指定しない問い合わせは蓄積した全ファイルを読む。読む量は蓄積とともに増える。`log_date` を指定すると、その日付のファイルだけを読む。蓄積が増えても、同じ日付の問い合わせの読む量は変わらない。

```sql
-- 1 日
SELECT q, COUNT(*) AS searches
FROM `blog-lacolaco-net.blog_analytics.search_events`
WHERE log_date = '20261007'
GROUP BY q ORDER BY searches DESC;

-- 期間 (両端を含む)。YYYYMMDD の文字列は日付順に並ぶので BETWEEN で比べられる
SELECT log_date, COUNT(*) AS searches
FROM `blog-lacolaco-net.blog_analytics.search_events`
WHERE log_date BETWEEN '20261001' AND '20261007'
GROUP BY log_date ORDER BY log_date;
```

- `log_date` の条件を他の列の条件と `OR` で結ぶと、日付で絞り込まれず全ファイルを読む。`AND` で結ぶ。
- 読む量は `bq query --maximum_bytes_billed=<上限>` で制限できる。外部表の dry-run は 0 バイトを返すので見積もりに使えない。実行後のジョブの `statistics.query.totalBytesProcessed` (`bq show -j --format=json <ジョブ ID>` の出力) で確かめる。`totalBytesBilled` は 1 問い合わせにつき 10 MiB が下限なので、読む量がそれに届くまでは、日付で絞っても絞らなくても同じ値になり、絞り込みの効果を確かめられない。
- 絞り込みの効果は、2026-10-08 に一時のバケットと外部表 (同じビューの SQL、1 日あたり約 40MB、11 日と 21 日の蓄積) で `totalBytesProcessed` を測って確かめた。指定なしは 440,021,340 と 840,027,390 バイトと蓄積に比例して増え、`log_date` で 1 日を指定すると蓄積が増えても 40,001,940 バイトのままだった。
- 外部表の hive パーティション (`mode=CUSTOM`、`source_uri_prefix` に `{log_date:STRING}`) は、`key=value` でない経路 `workers/<日付>/` では使えない。2026-10-08 に実データで試し、`Incompatible partition schemas` で問い合わせが失敗した。代わりに疑似列 `_FILE_NAME` から日付を取り出している。

- Logpush のフィルターは `Logs` (array) を条件に使えないため、生データ (`search_logs_raw`) には管理用エンドポイントの呼び出しや平文のログも入る。検索のイベントだけを選ぶのは `search_events` の SQL (`infra/terraform/search_events.sql.tftpl`) である。分析には `search_events` を使う。
- SQL の仕様は `infra/terraform/tests/search_events.test.sh` が固定の入力行で確かめる。BigQuery の認証が要るため CI では実行しない。SQL を変えたらローカルで実行する。
- データセット `blog_analytics` は、ブログが自分で集めるデータ (検索ログ、今後のクリックの記録など) をまとめて置く汎用の置き場である。いいねの集計は既存の `likes_analytics` に残り、移行は別項目で扱う。CI のサービスアカウント (`github-actions`) はデータセットを作る権限 (`bigquery.datasets.create`) を持たず、その権限をプロジェクト全体へ広げないため、データセットとその IAM は初回だけ権限のある利用者が `infra/terraform` をローカルで apply して作った。作成後は CI の apply に差分が出ない。データセットを作り直すときも同じ手順で行う。
- Workers Trace Events の `Logs` と `Exceptions` は合わせて 16,384 文字を超えると切り詰められる。切り詰められた JSON は解釈できず、`search_events` から除かれる。除かれた数は `search_log_quality` で数える (下の「取りこぼしの割合」)。検索 1 回のログは短いため通常は起きないが、1 回の呼び出しに大量のログが出ると、その検索が欠けうる。
- プレビューの Worker は `previews.logpush: false` で Logpush を止めている。wrangler のプレビューはトップレベルの `logpush` を継承し、止めないとプレビューの検索イベントが `ScriptName = blog-search` で送られて本番の検索語に混ざる。
- 検索語のマスクと保持期間の制限は設けない (個人情報を含む語が検索される見込みが無いというプロダクトオーナーの判断、2026-10-06)。バケットに削除のルールは無く、生データは残り続ける。個人情報が含まれると分かったら、`search_logs.tf` のバケットに `lifecycle_rule` を足す。
- 外部表を読むには、問い合わせる主体がバケットの読み取り権限 (`storage.objects.get`) も要る。`lacolaco-dwh` など別プロジェクトからビュー経由で読むときは、読む側にこの権限を与える (承認済みビューはデータセットの権限だけを移す)。

### 取りこぼしの割合

`search_events` は、検索の JSON が切り詰めで壊れた呼び出し、例外で終わった呼び出し、解釈できないログだけの呼び出しを黙って除く。除いた数は `search_log_quality` で数える。1 行は `(log_date, outcome, reason)` ごとの呼び出し (Logpush の 1 行 = Worker の 1 回の実行) の件数である。検索 API の 1 回の検索は 1 回の実行で、検索イベントは実行ごとに高々 1 件なので、実行を数えれば検索を数えたことになる。

| 列 | 内容 |
|---|---|
| `log_date` | `search_events` の `log_date` と同じ。直接比較で絞ると、その日のファイルだけを読む。本番の外部表で `totalBytesProcessed` を測ると、データの無い 20261006 は 0 バイト、ある 20261007 は 1,335 バイトだった (本番は 1 日分しかないので、絞らない場合との差は比べられない) |
| `outcome` | Workers Trace Events の `Outcome`。`ok` 以外 (`exception`、`exceededCpu`、`exceededMemory`、`canceled` など) が例外の種類 |
| `reason` | `search_events` との関係。実行ごとに次の順で最初に当てはまる 1 つ |
| `invocations` | その `(log_date, outcome, reason)` の呼び出しの件数 |

| `reason` | 意味 | 取りこぼしに数える |
|---|---|---|
| `kept` | 検索イベントが取れた (`search_events` に入った) | 数えない (分母に入る) |
| `truncated` | 検索の JSON が切り詰めで途中で切れた (`{"event":"search"` で始まり、JSON として解釈できない) | 数える |
| `exception` | `outcome` が `ok` でない (`truncated` を除く) | 数える |
| `unparsable` | JSON として解釈できないログがあり、上のどれでもない | 数える |
| `other` | 検索イベントも問題も無い (管理用エンドポイントの呼び出し、ログなしの実行) | 数えない (分母にも入らない) |

取りこぼしの割合は、取りこぼしに数える呼び出しを、`kept` と取りこぼしに数える呼び出しの合計で割った値である。

```sql
-- 期間 (両端を含む) の取りこぼしの件数と割合
SELECT
  SUM(IF(reason IN ('truncated', 'exception', 'unparsable'), invocations, 0)) AS dropped,
  SUM(IF(reason != 'other', invocations, 0)) AS total,
  SAFE_DIVIDE(
    SUM(IF(reason IN ('truncated', 'exception', 'unparsable'), invocations, 0)),
    SUM(IF(reason != 'other', invocations, 0))) AS dropped_share
FROM `blog-lacolaco-net.blog_analytics.search_log_quality`
WHERE log_date BETWEEN '20261001' AND '20261007';

-- 除いた理由と例外の種類の内訳
SELECT reason, outcome, SUM(invocations) AS invocations
FROM `blog-lacolaco-net.blog_analytics.search_log_quality`
WHERE log_date BETWEEN '20261001' AND '20261007' AND reason NOT IN ('kept', 'other')
GROUP BY reason, outcome ORDER BY invocations DESC;
```

数え方の限界:

- Logpush 自体の欠落 (ジョブの失敗の間のログ、バケットに届かなかったログ) は、このビューの外で起き、ここでは数えられない。割合は、バケットに届いたログの中での取りこぼしである。
- `exception` と `unparsable` は、検索の呼び出しだけに限れない。管理用エンドポイントの呼び出しが例外で終わった場合も数えるので、割合は検索の取りこぼしの上限側の見積もりになる。
- ログが 1 件も無い呼び出し (`other`) は、検索のログが失われたものか、検索ではない呼び出しか区別できないため、取りこぼしに数えない。
- 重複 (同じ検索が複数の行になること) はこのビューでは扱わない。

### 権限

| 主体 | 権限 | 理由 |
|---|---|---|
| `logpush@cloudflare-data.iam.gserviceaccount.com` (Cloudflare 共有) | バケットの `roles/storage.objectAdmin` | Logpush の書き込みと所有権の確認ファイルの読み書き (公式文書の指定)。鍵は発行しない |
| `github-actions` (CI) | 既存の `storage.admin` と、`blog_analytics` に限った `bigquery.dataOwner` | バケットの作成と、外部表・ビューの管理。プロジェクト全体の権限は広げない |
| `cf auth login` の OAuth (Logpush ジョブの作成と削除) | Logpush の編集 | トークンを作らずに済ませる。理由は `infra/terraform-logpush/README.md` |

長期の認証情報 (JSON 鍵やトークン) は経路に無いため、ローテーションの対象は無い。

### 止まったときに気づく手段

経路が止まる原因は、Logpush ジョブの停止 (送り先への書き込みが続けて失敗すると Cloudflare がジョブを止める)、バケットへの権限が外れること、Worker の `logpush` の解除である。検索 API は影響を受けず、検索語だけが届かなくなる。次を確かめる。

1. 最新の検索の時刻 (数日検索が無いと止まって見えるため、本番の検索 API に固有の語で 1 回問い合わせてから、約 2 分後に確かめる)。

   ```bash
   bq query --nouse_legacy_sql --maximum_bytes_billed=1000000000 \
     'SELECT MAX(searched_at) AS latest FROM `blog-lacolaco-net.blog_analytics.search_events`'
   ```

2. Logpush ジョブの状態 (名前は `blog-search-workers-trace-events`)。`enabled` が `true` で、`last_error` と `error_message` が `null` であること。`terraform -chdir=infra/terraform-logpush plan` の `check` も、ジョブが無い・止まっている・エラーがあるときに警告を出す。

   ```bash
   CLOUDFLARE_ACCOUNT_ID=<ゾーン lacolaco.net のアカウント ID> cf logpush account-jobs list
   ```

3. 停止していたら、権限 (`gcloud storage buckets get-iam-policy gs://blog-lacolaco-net-search-logs`) を確かめて直し、`terraform -chdir=infra/terraform-logpush apply -replace=terraform_data.logpush_job` でジョブを作り直す。ジョブを作り直した直後は、数分間のイベントが届かないことがある。
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
