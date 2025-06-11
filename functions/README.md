# Cloudflare Pages Functions

このディレクトリには、Cloudflare Pages Functions として動作するサーバーレス関数が含まれています。

## 概要

Cloudflare Pages Functions は、エッジで動作するサーバーレス関数です。Web サイトの API エンドポイントや動的コンテンツの生成に使用されます。

## 技術スタック

- **Runtime**: Cloudflare Workers Runtime
- **Language**: TypeScript (JSX 対応)
- **Build Target**: ESNext
- **JSX Runtime**: Preact

## 設定

### TypeScript 設定 (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "node",
    "lib": ["esnext"],
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

## Functions

### `/embed` - Web ページ埋め込みプレビュー

**エンドポイント**: `/embed?url=<URL>`

**概要**: 外部 Web ページのメタデータを取得し、リッチなプレビューカードを生成します。

#### 機能詳細

**入力パラメータ**:
- `url` (必須): プレビューを生成したい Web ページの URL

**出力**:
- HTML ページ（プレビューカード）
- `Content-Type: text/html; charset=utf-8`

#### メタデータ取得

以下の順序でメタデータを取得します：

**タイトル取得** (優先順位):
1. `og:title` - Open Graph タイトル
2. `<meta name="title">` - メタタイトル
3. `<title>` - ドキュメントタイトル
4. URL（フォールバック）

**説明文取得** (優先順位):
1. `og:description` - Open Graph 説明文
2. `<meta name="description">` - メタ説明文
3. `twitter:description` - Twitter Card 説明文
4. 空文字（フォールバック）

**画像取得** (優先順位):
1. `og:image` - Open Graph 画像
2. `twitter:image` - Twitter Card 画像
3. `<meta name="image">` - メタ画像
4. 最初の `<img>` タグの `src`
5. `null`（フォールバック）

#### 特別な処理

**Amazon URL の特別処理**:
- Amazon ドメイン (`amazon.co.jp`, `amzn.asia`) には Googlebot User Agent を使用
- サーバーサイドレンダリングされた HTML を取得するため

**User Agent**:
- Amazon: `Googlebot/2.1` (モバイル版)
- その他: `blog.lacolaco.net`

#### キャッシュ戦略

**Cloudflare エッジキャッシュ**:
- キャッシュ時間: 24 時間 (`max-age=86400`)
- キャッシュバイパス: `Cache-Control: no-cache` ヘッダーで強制更新可能

**キャッシュロジック**:
```typescript
// クライアントがキャッシュバイパスを要求した場合
const shouldBypassCache = context.request.headers.get('cache-control')?.includes('no-cache');

if (!shouldBypassCache) {
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }
}
```

#### 生成される HTML 構造

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <meta name="robots" content="noindex" />
    <title>${title}</title>
    <style>/* CSS スタイル */</style>
  </head>
  <body>
    <a href="${url}" class="block-link block-link-webpage webpage-card">
      <div class="webpage-card-content">
        <h3 class="webpage-card-title">${title}</h3>
        <p class="webpage-card-description">${description || hostname}</p>
      </div>
      ${imageUrl ? `<img src="${imageUrl}" alt="Page image" class="webpage-card-image">` : ''}
    </a>
  </body>
</html>
```

#### CSS スタイル

**レスポンシブデザイン**:
- フレックスボックスレイアウト
- ダークモード対応 (`@media (prefers-color-scheme: dark)`)
- ホバーエフェクト

**主要スタイル**:
- カード型レイアウト（境界線、角丸、シャドウ）
- 16:9 アスペクト比の画像表示
- テキストオーバーフロー処理（省略記号）

#### エラーハンドリング

**URL パラメータ不正**:
```
HTTP 400 Bad Request
"Missing url parameter"
```

#### 使用例

```bash
# 基本的な使用例
curl "https://example.com/embed?url=https://github.com"

# キャッシュバイパス
curl -H "Cache-Control: no-cache" "https://example.com/embed?url=https://github.com"
```

#### 依存関係

**外部ライブラリ**:
- `cheerio` - HTML パースとメタデータ抽出
- `@cloudflare/workers-types` - TypeScript 型定義

**内部実装**:
- 標準 CSS（外部フレームワーク依存なし）
- Fetch API による HTTP リクエスト
- Cloudflare Cache API

## デプロイメント

Functions は `pnpm build` コマンドでビルドされ、`dist/worker/` ディレクトリに出力されます。Cloudflare Pages の自動デプロイメントにより本番環境に配信されます。

## 開発・テスト

**ローカル開発**:
```bash
pnpm dev  # Astro 開発サーバー (Functions も含む)
```

**プロダクションビルド**:
```bash
pnpm build  # Astro + Functions のビルド
```

## セキュリティ

- `noindex` メタタグによる検索エンジンインデックス回避
- 外部 URL へのリクエストは適切な User Agent で実行
- XSS 防止のため出力は適切にエスケープ処理