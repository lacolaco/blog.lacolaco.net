# Notion Fetch Tool

`notion-fetch` は、Notionデータベースで管理されているブログ記事データを取得し、Astroプロジェクト用の中間表現JSONを生成するツールです。

## 概要

このツールは以下の処理を実行します：

1. **Notionデータベースのプロパティ取得**: タグ・カテゴリ情報の取得
2. **メタデータの生成**: `tags.json`、`categories.json` の生成
3. **記事データの取得**: Notionデータベースから記事ページの取得
4. **コンテンツ変換**: Notionブロックから中間表現JSONへの変換
5. **画像ファイル処理**: Notion画像の ダウンロード・ローカル保存
6. **JSONファイル出力**: ブログ記事用JSON形式での保存

## ディレクトリ構造

```
tools/notion-fetch/
├── README.md           # このファイル
├── main.ts            # エントリーポイント
├── utils.ts           # 共通ユーティリティ
├── content/           # コンテンツ変換関連
│   ├── index.ts       # エクスポート
│   ├── post.ts        # ブログ記事変換
│   ├── properties.ts  # プロパティ変換
│   └── transformer.ts # Notionブロック変換
└── file-system/       # ファイルシステム操作
    └── index.ts       # FileSystemクラス
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

# デバッグモード
pnpm notion-fetch --debug
```

### コマンドライン オプション

| オプション  | 短縮形 | 説明                                 |
| ----------- | ------ | ------------------------------------ |
| `--dry-run` | `-D`   | ファイル書き込みを実行せずに動作確認 |
| `--force`   | `-f`   | 強制実行（現在未使用）               |
| `--debug`   | なし   | デバッグ情報の出力（現在未使用）     |

## アーキテクチャ

### データフロー

```
Notion Database
      ↓
BlogDatabase.query()
      ↓
ContentTransformer.transformContent()
      ↓
中間表現JSON
      ↓
FileSystem.save()
      ↓
src/content/post/*.json
```

### 主要コンポーネント

#### 1. `main.ts` - エントリーポイント

- 環境変数の検証
- コマンドライン引数の解析
- 各FileSystemインスタンスの初期化
- 実行フローの制御

#### 2. `content/` - コンテンツ変換

**`post.ts`**

- `toBlogPostJSON()`: Notionページを中間表現に変換
- ページプロパティの抽出・変換
- Zodスキーマによるバリデーション

**`properties.ts`**

- `toTagsJSON()`: タグ設定の変換
- `toCategoriesJSON()`: カテゴリ設定の変換

**`transformer.ts`**

- `ContentTransformer`: Notionブロックの変換クラス
- 各種ブロックタイプ（見出し、段落、画像など）の処理
- リッチテキストの変換

#### 3. `file-system/` - ファイル操作

**`FileSystem` クラス**

- ファイルの保存・読み込み・削除
- ディレクトリの自動作成
- ドライランモードの対応

#### 4. `utils.ts` - ユーティリティ

- `formatJSON()`: Prettierによる JSON整形
- `getFile()`: リモートファイルの取得

## 変換対応ブロックタイプ

| Notionブロック       | 中間表現ノード                               | 説明                   |
| -------------------- | -------------------------------------------- | ---------------------- |
| `heading_1-3`        | `HeadingNode`                                | 見出し（レベル1-3）    |
| `paragraph`          | `ParagraphNode`                              | 段落                   |
| `divider`            | `DividerNode`                                | 区切り線               |
| `quote`              | `QuoteNode`                                  | 引用                   |
| `code`               | `CodeNode`                                   | コードブロック         |
| `bulleted_list_item` | `BulletedListNode`                           | 箇条書きリスト         |
| `numbered_list_item` | `NumberedListNode`                           | 番号付きリスト         |
| `callout`            | `CalloutNode`                                | コールアウト           |
| `image`              | `ImageNode`                                  | 画像（外部・ローカル） |
| `video`              | `YoutubeNode`                                | YouTube動画            |
| `equation`           | `EquationNode`                               | 数式                   |
| `toggle`             | `DetailsNode`                                | 折りたたみ             |
| `embed`              | `EmbedNode` / `TweetNode` / `StackblitzNode` | 埋め込み               |
| `bookmark`           | `LinkPreviewNode` / `EmbedNode`              | ブックマーク           |
| `link_preview`       | `LinkPreviewNode`                            | リンクプレビュー       |
| `table`              | `TableNode`                                  | テーブル               |

## 画像処理

### 外部画像

- Notion外部画像URLの場合、URLをそのまま保持
- `ImageNode.external = true`

### Notion内部画像

- Notion内部画像の場合、ローカルに ダウンロード
- ファイル名: `{slug}{fileId}.{extension}`
- 保存先: `public/images/{slug}{fileId}.{extension}`
- `ImageNode.external = false`

## 出力ファイル

### ブログ記事JSON

- **場所**: `src/content/post/{slug}.json` または `src/content/post/{slug}.{locale}.json`
- **形式**: `PostData` 型（Zodスキーマ）
- **内容**: 記事メタデータ + 中間表現コンテンツ

### メタデータJSON

- **タグ**: `src/content/tags/tags.json`
- **カテゴリ**: `src/content/categories/categories.json`

## 中間表現の構造

```typescript
interface PostData {
  pageId: string; // NotionページID
  lastEditedAt: string; // 最終編集日時
  slug: string; // URLスラッグ
  locale: 'ja' | 'en'; // ロケール
  properties: {
    title: string; // タイトル
    date: Date; // 公開日
    category?: string; // カテゴリ
    tags: string[]; // タグ配列
    updatedAt?: Date; // 更新日
    canonicalUrl?: string; // 正規URL
  };
  content: ContentNode[]; // コンテンツノード配列
}
```

## エラーハンドリング

- 環境変数未設定時は即座に終了
- ファイル取得失敗時はエラーメッセージと共に例外発生
- 不明なブロックタイプは例外発生
- Zodスキーマバリデーション失敗時は例外発生

## パフォーマンス

- 記事の並列処理により高速化
- 画像の並列ダウンロード
- 既存画像ディレクトリの事前削除

## 依存関係

- `@lacolaco/notion-db`: Notion API クライアント
- `@lib/notion`: Notion関連ユーティリティ
- `@lib/post`: ポスト関連型定義・スキーマ
- `prettier`: JSON整形
- `zod`: データバリデーション

## 開発・デバッグ

### ローカル実行

```bash
pnpm notion-fetch --dry-run
```

### ログ確認

- 各処理ステップでコンソール出力
- エラー時の詳細情報出力
- 処理件数の表示

## 今後の拡張

- より多くのNotionブロックタイプの対応
- 画像の最適化処理
- 増分同期機能
- キャッシュ機能の実装
