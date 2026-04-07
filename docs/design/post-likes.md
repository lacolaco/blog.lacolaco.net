# Post Likes (スキ) 機能設計書

## 概要

note.com準拠のいいね(スキ)機能。未ログインでもスキ可能。

## 制約

| 制約 | 根拠 |
|------|------|
| データストア: Firestore Native mode | GCPネイティブ唯一の無料DB |
| アクセス: REST API via fetch() | Firestore SDK不可（gRPC結合によるシステム境界違反） |
| コンピュート: Astro API route (prerender: false) | 別サービス（Cloud Run/Cloud Functions/CF Workers）不可 |
| コスト: Firestore無料枠内 | 個人ブログ |

## インフラ

| リソース | 環境 | 値 |
|---------|------|-----|
| Firestore DB | production | `likes-production` (asia-northeast1) |
| Firestore DB | preview | `likes-preview` (asia-northeast1) |
| Cloud Run環境変数 | 全環境 | `FIRESTORE_DATABASE` |

Cloud RunとFirestoreが同一リージョン (asia-northeast1)。遅延 ~10ms。

### 初期構築

```bash
gcloud firestore databases create --location=asia-northeast1 --database=likes-production --type=firestore-native --project=blog-lacolaco-net
gcloud firestore databases create --location=asia-northeast1 --database=likes-preview --type=firestore-native --project=blog-lacolaco-net
```

### アクセス制御

全アクセスはCloud Run サービスアカウント → REST API 経由。IAM (`roles/editor`) で制御。
Firestore Security RulesはFirebase Client SDK向けの仕組みであり、サービスアカウント経由のアクセスはバイパスするため不使用。

### 環境変数

GCPプロジェクトIDはCloud Runメタデータサーバーから取得。環境変数は不要。

- `FIRESTORE_DATABASE`: Firestoreデータベース名 (`likes-production` or `likes-preview`)。明示的に設定必須。デフォルト値なし。未設定時はエラー

### 環境変数の注入方法

`.github/actions/deploy-cloudrun/action.yml` に `env_vars` 入力を追加し、`google-github-actions/deploy-cloudrun` の `env_vars` パラメータに渡す。

```yaml
# deploy-production.yml
- uses: ./.github/actions/deploy-cloudrun
  with:
    env_vars: |
      FIRESTORE_DATABASE=likes-production

# deploy-preview.yml
- uses: ./.github/actions/deploy-cloudrun
  with:
    env_vars: |
      FIRESTORE_DATABASE=likes-preview
```

## データモデル

```
{FIRESTORE_DATABASE} > post_likes/{slug}
  └─ reactions: Map<clientId, boolean>
```

- `count`フィールドは持たない。`Object.keys(reactions).length`で導出
  - NaN不可能、負数不可能、increment/reactionの不整合不可能
- ドキュメントサイズ上限 1MB。UUID (36B) + メタ ≒ 40B/reaction。最大約25,000 reactions/slug
- clientId (UUID v4) はハイフン含むがドット不含。Firestoreフィールドパスの`.`区切りと競合しない

## API

### GET /api/likes/{slug}

スキ状態を取得する。

- Request Header: `x-client-id: {uuid v4}` (任意。空の場合 liked=false)
- Response: `{ count: number, liked: boolean }`
- Firestore操作: getDoc 1回

### POST /api/likes/{slug}

スキをトグルする。

- Request Header: `x-client-id: {uuid v4}` (必須)
- Response: `{ count: number, liked: boolean }`
- Firestore操作: getDoc 1回 + commit 1回

## バリデーション

| 項目 | ルール | 違反時 |
|------|--------|--------|
| slug | `/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/`, max 200文字 | 400 |
| clientId (POST) | UUID v4正規表現 | 400 |
| clientId (GET) | 空許容 | liked=false |
| レート制限 | IP+slug単位、1秒1回、LRU Map上限1000 | 429 |

## エラーハンドリング

| 障害 | 対処 |
|------|------|
| メタデータサーバー不応答 | 500返却。楽観的UIがロールバック |
| Firestore 404 (ドキュメント未存在) | 正常系。count: 0, liked: false |
| Firestore 500/503 | 500返却。楽観的UIがロールバック |
| トークン期限切れ (401) | キャッシュ無効化 → 再取得 → リトライ1回 |

## レースコンディション

GET (reactions読み取り) と commit (reactions書き込み) の間に別リクエストが割り込む可能性。

- 同一clientIdの同時トグル: count ±1ずれうる
- 異なるclientId: updateMaskが別フィールドを操作するため干渉なし
- 個人ブログの同時アクセス頻度では実質発生しない

## 環境分離

| | Production | Preview |
|---|---|---|
| Firestore DB | `likes-production` | `likes-preview` |
| コレクション | `post_likes` | `post_likes` |

DBレベルで完全分離。データ・クォータ・アクセスが独立。
コレクション名は同一。分離はDB層で担保。
環境変数 `FIRESTORE_DATABASE` にデフォルト値なし。未設定時エラー。

## ローカル開発

```bash
gcloud emulators firestore start --host-port=localhost:8080
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm dev
```

エミュレータ接続時はトークン不要。

## クライアント

- clientId: localStorage UUID v4。不正値は再生成。localStorage不可時 (Safari Private等) はセッション限定UUID
- liked状態: 楽観的UI更新。クリック即座に反映、API応答はバックグラウンド
- エラー時: ロールバック + like_errorアナリティクスイベント
- compact/standard 2インスタンス間の同期: CustomEvent

## テストプラン

### PR1: Firestore RESTクライアント + likesリポジトリ (26テスト)

**トークン管理 (4テスト)**

| # | テスト | 期待結果 |
|---|--------|---------|
| 1 | メタデータサーバーからトークン取得 | fetchがmetadata URLに発行される |
| 2 | キャッシュ有効期間内は再取得しない | metadata fetchは1回のみ |
| 3 | キャッシュ期限切れで再取得 | metadata fetchが再実行される |
| 4 | メタデータサーバー障害 | エラーthrow |

**ドキュメント取得 (4テスト)**

| # | テスト | 期待結果 |
|---|--------|---------|
| 5 | 正しいURLとAuthorizationでfetch | BASE/path にBearerトークン付きGET |
| 6 | 存在するドキュメント | パース済みドキュメント返却 |
| 7 | 存在しないドキュメント (404) | null返却 |
| 8 | サーバーエラー (500) | エラーthrow |

**バッチ書き込み (4テスト)**

| # | テスト | 期待結果 |
|---|--------|---------|
| 9 | 正しいURLとbodyでPOST | BASE:commit にJSON付きPOST |
| 10 | 成功 | 正常終了 |
| 11 | 失敗 (500) | エラーthrow |
| 12 | 401でリトライ | トークン再取得 → 2回目成功 |

**getLikeStatus (6テスト)**

| # | テスト | 期待結果 |
|---|--------|---------|
| 13 | ドキュメント未存在 | { count: 0, liked: false } |
| 14 | reactionsが空 | { count: 0, liked: false } |
| 15 | 自分のIDあり (3人中) | { count: 3, liked: true } |
| 16 | 自分のIDなし (2人中) | { count: 2, liked: false } |
| 17 | clientId空文字 | { count: N, liked: false } |
| 18 | reactionsフィールドなし | { count: 0, liked: false } |

**toggleLike (8テスト)**

| # | テスト | 期待結果 |
|---|--------|---------|
| 19 | 未いいね → Like (初回) | commit発行。{ count: 1, liked: true } |
| 20 | 未いいね → Like (既存reactions有) | commit発行。{ count: N+1, liked: true } |
| 21 | いいね済み → Unlike | commit発行。{ count: N-1, liked: false } |
| 22 | 空clientId | エラーthrow |
| 23 | 不正clientId形式 | エラーthrow |
| 24 | 不正slug | エラーthrow |
| 25 | Firestore GETエラー伝播 | エラーthrow |
| 26 | Firestore commitエラー伝播 | エラーthrow |

### PR2: APIエンドポイント (9テスト)

| # | テスト | 期待結果 |
|---|--------|---------|
| 27 | GET 正常系 | 200 + { count, liked } |
| 28 | GET clientId無し | 200 + { count: N, liked: false } |
| 29 | GET 不正slug | 400 |
| 30 | GET slug長すぎ | 400 |
| 31 | GET 不正clientId | 400 |
| 32 | POST 正常系 | 200 + { count, liked } |
| 33 | POST clientId無し | 400 |
| 34 | POST レート制限超過 | 429 |
| 35 | POST 内部エラー | 500 |

### PR3: クライアントライブラリ (7テスト)

| # | テスト | 期待結果 |
|---|--------|---------|
| 36 | getOrCreateClientId: 既存UUID | そのまま返却 |
| 37 | getOrCreateClientId: 不正値 | 再生成+保存 |
| 38 | getOrCreateClientId: 未存在 | 生成+保存 |
| 39 | getOrCreateClientId: localStorage不可 | セッション限定UUID |
| 40 | fetchLikeStatus | x-client-idヘッダ付きGET |
| 41 | sendToggleLike | x-client-idヘッダ付きPOST |
| 42 | エラーレスポンス | エラーthrow |

### PR4: UI (6項目、手動検証)

| # | 検証項目 | 方法 |
|---|---------|------|
| 43 | compact LikeButton (タイトル下) | 4幅スクリーンショット |
| 44 | standard LikeButton (記事下) | 4幅スクリーンショット |
| 45 | クリック → 楽観的UI更新 | ブラウザ操作 |
| 46 | パーティクルアニメーション | ブラウザ操作 |
| 47 | ページリロード → liked状態復元 | ブラウザ操作 |
| 48 | compact/standard間の同期 | 片方クリック → 他方も更新 |

## PR分割

| PR | スコープ | 依存 |
|---|---------|------|
| 1 | Firestore RESTクライアント + likesリポジトリ + テスト | なし |
| 2 | APIエンドポイント + バリデーション + レート制限 | PR1 |
| 3 | クライアントライブラリ + analytics | PR2 |
| 4 | LikeButton UI + PostDetailPage統合 + 4幅検証 | PR3 |
