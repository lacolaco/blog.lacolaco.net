# ブログ記事いいね（スキ）機能の設計

## Context

ブログ記事にnote.comの「スキ」に準拠したいいね機能を追加する。ユーザー認証は持たない前提（noteも未ログインでスキ可能）。あらゆる面でnoteに合わせる。

## noteのスキ仕様（準拠対象）

### 位置・レイアウト（note準拠: インライン2箇所）
- **タイトル下**: 日付・ツールバーの下、ArticleSummarizerの前にインライン配置
- **記事下**: 記事本文の下、ShareButtonsと同じエリアにインライン配置
- PC/SP共通で同じ2箇所。フローティングなし。常に同じ位置

### ビジュアル（note準拠: `--color-text-like: #d13e5c`）
- **未スキ**: アウトラインのハートアイコン（グレー系）
- **スキ済み**: 塗りつぶしハートアイコン（noteの赤 `#d13e5c`）
- カウント数はハートの横に表示
- カウント0でも数値表示

### インタラクション
- トグル: 再クリックでスキ取り消し（ハートがグレーに戻る）
- **アニメーション**: スキ時にハートからカラフルなオブジェが花火のように飛び出す（note準拠）
- 楽観的UI更新（即座に反映→API呼び出し）

### 認証（note準拠）
- 未ログインでもスキ可能（noteは2018年〜この仕様）
- 同一ブラウザからは1記事に1スキ

### 省略する機能
- **リアクションポップアップ**: noteではスキ後にお礼メッセージが表示されるが、省略。アニメーションのみ実装

## アーキテクチャ

```
[Browser]
  ├─ LikeButton.tsx (React, client:idle)
  │   ├─ localStorage: clientId (UUID v4) + liked slugs
  │   └─ fetch → /api/likes/{slug}
  │
[Cloud Run (Astro SSR)]
  ├─ GET  /api/likes/{slug} → { count, liked }
  ├─ POST /api/likes/{slug} → { count, liked } (toggle)
  │
[Google Cloud Firestore]
  └─ post_likes/{slug}
       ├─ count: number
       └─ reactions/{clientId} (subcollection)
            └─ created_at: Timestamp
```

## データモデル (Firestore)

```
post_likes/{slug}
  count: number           // スキ総数
  updated_at: Timestamp   // 最終更新

post_likes/{slug}/reactions/{clientId}
  created_at: Timestamp   // スキした日時
```

- `count` はトランザクションで increment/decrement
- `reactions` サブコレクションで重複防止（clientId単位）
- clientId はブラウザのlocalStorageに保存するUUID v4（noteの未ログインスキと同等）

## API設計

### `GET /api/likes/[slug].ts`
- Query: `?clientId=xxx` (optional)
- Response: `{ count: number, liked: boolean }`

### `POST /api/likes/[slug].ts`
- Body: `{ clientId: string }`
- Firestoreトランザクション:
  - `reactions/{clientId}` 存在 → 削除 + count -1 (unlike)
  - 存在しない → 作成 + count +1 (like)
- Response: `{ count: number, liked: boolean }`
- レート制限: 同一clientIdの2秒以内の再トグルを429で拒否

## UIコンポーネント

### `LikeButton.tsx` — noteのスキUIに完全準拠

#### レイアウト（PC/SP共通: インライン2箇所配置）
```
┌─────────────────────────────────┐
│  Header                         │
│                                 │
│  ┌─────────────────────────┐    │
│  │ タイトル                │    │
│  │ 日付    ツール          │    │
│  │ ♡ 42                   │ ← タイトル下（位置①）
│  │ [ArticleSummarizer]    │    │
│  │                        │    │
│  │ 記事本文...            │    │
│  │                        │    │
│  │ タグ / チャンネル      │    │
│  │ ♡ 42                   │ ← 記事下（位置②）
│  │ シェアボタン群          │    │
│  │ PostNavigation          │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

- 位置①: `PostDetailPage.astro` のツールバー（L80-114）の直後、ArticleSummarizer（L116）の直前
- 位置②: タグ/チャンネル（L125-128）の直後、ShareButtons（L130-132）の直前
- 両方とも同一のslugを参照し、同じカウントを表示。片方をクリックすると両方が同期更新

#### ビジュアル（note準拠）
- ハートアイコン: SVGで描画（アウトライン / 塗りつぶし切り替え）
- 未スキ色: グレー（`text-muted` 相当）
- スキ済み色: `#d13e5c`（noteの `--color-text-like`）
- カウント: ハート右横に表示。フォントサイズは周囲のメタ情報と合わせる
- ボタン全体: `flex items-center gap-1` で横並び

#### アニメーション（note準拠: 花火エフェクト）
- **スキ時**: ハートアイコンがスケールアップ → カラフルなパーティクル（丸、星、ハート形のオブジェ）がハートから放射状に飛び出す
- **取り消し時**: ハートが静かにアウトラインに戻る（アニメーションなし）
- CSS animation + requestAnimationFrame で実装
- パーティクルは `position: absolute` でハート要素の中心から発射、フェードアウト後にDOM除去

#### 2箇所の同期
- 同一ページ内の2つのLikeButtonは同じカスタムイベント（`CustomEvent`）でカウント・状態を同期
- 片方でスキ → `dispatchEvent` → もう片方が `addEventListener` で受信 → 状態更新
- APIコールは操作した側のみが発行

#### 状態管理
```typescript
type LikeState = 'loading' | 'idle' | 'liked' | 'error';
```
- `loading`: 初期取得中（ハートはグレー、カウント `-`）
- `idle`: 未スキ（アウトラインハート、グレー）
- `liked`: スキ済み（塗りつぶしハート、`#d13e5c`）
- `error`: API失敗（最後の状態を維持、リトライ可能）

#### Analytics
- `like_toggle` イベント: `{ action: "like" | "unlike", slug: string }`

## 変更対象ファイル

### 新規作成
| ファイル | 内容 |
|---------|------|
| `src/libs/likes/firestore.ts` | Firestore初期化（ADC認証） |
| `src/libs/likes/index.ts` | スキ取得・トグルロジック |
| `src/pages/api/likes/[slug].ts` | APIエンドポイント (`prerender: false`) |
| `src/components/LikeButton.tsx` | Reactコンポーネント（インライン2箇所対応 + 花火エフェクト内蔵） |
| `src/libs/likes/__tests__/likes.test.ts` | ユニットテスト |

### 変更
| ファイル | 変更内容 |
|---------|---------|
| `src/layouts/PostDetailPage.astro` | LikeButton追加（タイトル下 + 記事下の2箇所） |
| `package.json` | `@google-cloud/firestore` 追加 |

## Firestore認証・セットアップ

- Cloud Run: ADC（Application Default Credentials）で自動認証
- ローカル: `compose.yml` でADCマウント済み
- 必要なGCP設定:
  - Firestoreデータベース作成（Native mode）
  - サービスアカウントに `roles/datastore.user` 付与
  - プロジェクトID: `blog-lacolaco-net`

## スパム対策（note準拠）

| レイヤー | 対策 |
|---------|------|
| クライアント | localStorage にclientId + スキ済みslug。UIレベル連打防止 |
| サーバー | clientId単位でFirestore subcollection。同一clientIdの重複スキ防止 |
| レート制限 | トグル間隔2秒制限 |

noteも未ログインスキはブラウザ単位の制御。完全なスパム防止ではないが同等レベル。

## 検証方法

### TDD（テストファースト）
1. `likes.test.ts`:
   - Firestoreモックで `getLikeCount` / `toggleLike` のロジックテスト
   - 未スキ→スキ: count +1, liked: true
   - スキ済み→取り消し: count -1, liked: false
   - レート制限: 2秒以内の再トグル拒否

### 動作確認
1. `pnpm dev` でPC/SP両方のレイアウト確認
2. スキ→カウント増加→ハート赤→パーティクルアニメーション
3. 再クリック→カウント減少→ハートグレー
4. ページリロード→スキ状態維持
5. 4幅（375px, 768px, 1024px, 1440px）でレスポンシブ確認

### ビルド
- `pnpm build` で静的ページ+動的APIエンドポイント確認
- `pnpm lint && pnpm format` パス確認
