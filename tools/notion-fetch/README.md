# Notion Fetch Tool

`notion-fetch` は、Notionデータベースで管理されているブログ記事データを取得し、Astroプロジェクト用のMarkdownファイルを直接生成するツールです。

## 概要

このツールは以下の処理を実行します：

1. **Notionデータベースのプロパティ取得**: タグ・カテゴリ情報の取得
2. **メタデータの生成**: `tags.json`、`categories.json` の生成
3. **記事データの取得**: Notionデータベースから記事ページの取得
4. **Markdown変換**: Notionブロックから直接Markdownへの変換
5. **画像ファイル処理**: Notion画像の並列ダウンロード・ローカル保存
6. **Markdownファイル出力**: フロントマター付きMarkdownファイルの保存

## ディレクトリ構造

```
tools/notion-fetch/
├── README.md                  # このファイル
├── main.ts                   # エントリーポイント（統合されたユーティリティ含む）
├── notion-types.ts           # Notion API型定義
├── page-transformer.ts       # ページ→Markdown変換
├── page-transformer.spec.ts  # ページ変換テスト
├── block-transformer.ts      # ブロック→Markdown変換
├── block-transformer.spec.ts # ブロック変換テスト
└── fixtures/                 # テストフィクスチャ
    ├── *.json                # テスト用Notionブロック
    └── page-kitchen-sink.md  # 期待値Markdownファイル
```

## 使用方法

### 環境変数の設定

```bash
export NOTION_AUTH_TOKEN="your_notion_integration_token"
```

### コマンド実行

```bash
# 通常実行
pnpm notion-fetch

# ドライラン（ファイル書き込みなし）
pnpm notion-fetch --dry-run

# 強制実行
pnpm notion-fetch --force

# デバッグモード（生データ出力）
pnpm notion-fetch --debug
```

### コマンドライン オプション

| オプション  | 短縮形 | 説明                                         |
| ----------- | ------ | -------------------------------------------- |
| `--dry-run` | `-D`   | ファイル書き込みを実行せずに動作確認         |
| `--force`   | `-f`   | 強制実行                                     |
| `--debug`   | なし   | デバッグ情報の出力（`.tmp`ディレクトリ作成） |
| `--draft`   | `-d`   | 下書き記事も含めて取得                       |

## アーキテクチャ

### データフロー

```
Notion Database
      ↓
BlogDatabase.query()
      ↓
transformNotionPageToMarkdown()
      ↓
Markdownファイル + 画像ダウンロードタスク
      ↓
downloadImages() (並列実行)
      ↓
src/content/post/*.md + public/images/{slug}/
```

### 主要コンポーネント

#### 1. `main.ts` - エントリーポイント（統合ファイル）

- 環境変数の検証
- コマンドライン引数の解析
- **統合された機能**:
  - `FileSystem` クラス（ファイル操作）
  - `formatJSON()` 関数（JSON整形）
  - `toTagsJSON()`, `toCategoriesJSON()` 関数（メタデータ変換）
  - `downloadImages()` 関数（画像並列ダウンロード）
- ページの並列処理・画像の並列ダウンロード

#### 2. `page-transformer.ts` - ページ変換

- `transformNotionPageToMarkdown()`: Notionページを直接Markdownに変換
- フロントマターの生成（title, slug, tags, category等）
- 画像ダウンロードタスクの抽出
- Prettierによる整形

#### 3. `block-transformer.ts` - ブロック変換

- `transformNotionBlocksToMarkdown()`: Notionブロック配列をMarkdown文字列に変換
- `TransformContext`: スラッグ・画像ダウンロードタスクの管理
- 各種ブロックタイプの直接的なMarkdown出力

#### 4. `notion-types.ts` - 型定義

- Notion API用の包括的なTypeScript型定義

## 変換対応ブロックタイプ

| Notionブロック       | Markdown出力                                       | 説明                   |
| -------------------- | -------------------------------------------------- | ---------------------- |
| `heading_1-3`        | `# ## ###`                                         | 見出し（レベル1-3）    |
| `paragraph`          | 段落テキスト                                       | 段落                   |
| `divider`            | `---`                                              | 区切り線               |
| `quote`              | `> 引用文`                                         | 引用                   |
| `code`               | `language\ncode\n`                                 | コードブロック         |
| `bulleted_list_item` | `- リストアイテム`                                 | 箇条書きリスト         |
| `numbered_list_item` | `1. リストアイテム`                                | 番号付きリスト         |
| `callout`            | `> [!NOTE]\n> 内容`                                | GitHub Alert構文       |
| `image`              | `![caption](URL)`                                  | 画像（外部・ローカル） |
| `video`              | 動画URL                                            | 動画埋め込み           |
| `equation`           | `$$\nequation\n$$`                                 | 数式                   |
| `toggle`             | `<details><summary>見出し</summary>内容</details>` | 折りたたみ             |
| `embed`              | 埋め込みURL                                        | 埋め込み               |
| `bookmark`           | ブックマークURL                                    | ブックマーク           |
| `link_preview`       | リンクURL                                          | リンクプレビュー       |
| `table`              | Markdown Table                                     | テーブル               |

## 画像処理

### 外部画像

- Notion外部画像URLの場合、URLをそのまま出力
- `![caption](https://external-url.com/image.png)`

### Notion内部画像

- Notion内部画像の場合、ローカルに並列ダウンロード
- ファイル名: URLパスから自動抽出（例: `image.png`）
- 保存先: `public/images/{slug}/{filename}`
- Markdown出力: `![caption](/images/{slug}/{filename})`

### 画像ダウンロードの仕組み

1. ブロック変換時に`TransformContext`に画像ダウンロードタスクを追加
2. 変換完了後、`downloadImages()`で並列ダウンロード実行
3. スラッグ別ディレクトリに整理して保存

## 出力ファイル

### ブログ記事Markdown

- **場所**: `src/content/post/{slug}.md` または `src/content/post/{slug}.{locale}.md`
- **形式**: フロントマター + Markdownコンテンツ
- **フロントマター**: title, slug, icon, created_time, tags, category, published等

### メタデータJSON

- **タグ**: `src/content/tags/tags.json`
- **カテゴリ**: `src/content/categories/categories.json`

### 画像ファイル

- **場所**: `public/images/{slug}/`
- **ファイル名**: 元URLから抽出されたファイル名

## 出力例

### Markdownファイルの構造

```markdown
---
title: 'ブログ記事タイトル'
slug: 'blog-post-slug'
icon: '📝'
created_time: '2023-01-01T00:00:00.000Z'
last_edited_time: '2023-01-02T00:00:00.000Z'
category: 'tech'
tags: ['angular', 'typescript']
published: true
notion_url: 'https://notion.so/...'
---

# 記事内容

本文の内容がMarkdown形式で出力されます。

![画像キャプション](/images/blog-post-slug/image.png)

## セクション

- リストアイテム1
- リストアイテム2
```

## エラーハンドリング

- 環境変数未設定時は即座に終了
- 画像ダウンロード失敗時はエラーログ出力後に例外発生
- 不明なブロックタイプはHTMLコメントで出力
- 型安全性を重視し、TypeScriptの厳密な型チェックを活用

## パフォーマンス

- **並列処理**: 記事変換の並列実行
- **並列ダウンロード**: 画像の並列ダウンロード
- **事前削除**: 既存画像ディレクトリの事前削除
- **直接変換**: 中間表現を経由せずNotionから直接Markdownに変換

## 依存関係

- `@lacolaco/notion-db`: Notion API クライアント
- `prettier`: Markdown/JSON整形
- Node.js標準モジュール: `fs/promises`, `util`

## テスト

### テスト実行

```bash
# notion-fetchのテスト実行
pnpm test:notion-fetch
```

### テスト構成

- **フィクスチャベース**: `fixtures/`ディレクトリのJSONファイルを使用
- **単体テスト**: 各変換関数の動作検証
- **型安全性**: TypeScriptの厳密な型チェック

## 開発・デバッグ

### ローカル実行

```bash
# ドライランでの動作確認
pnpm notion-fetch --dry-run

# デバッグモードでの実行
pnpm notion-fetch --debug
```

### ログ確認

- 各処理ステップでコンソール出力
- 画像ダウンロード進捗の表示
- エラー時の詳細情報出力

### デバッグ機能

- `--debug`フラグで`.tmp`ディレクトリに生データ出力
- 変換前のNotionページデータをJSONで確認可能

## 設計原則

### Test-Driven Development (TDD)

- 機能追加は必ずテストファーストで実装
- 型安全性を重視した設計
- Pure Functionによる副作用の最小化

### Markdown First

- 中間表現を介さない直接的なMarkdown生成
- GitHubスタイルの拡張Markdown記法に対応
- Astro Content Collectionsとの完全互換性

## 今後の拡張

- より多くのNotionブロックタイプの対応
- 画像の最適化処理（WebP変換等）
- 増分同期機能の実装
- キャッシュ機能による高速化
