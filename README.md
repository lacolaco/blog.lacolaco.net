![deploy](https://github.com/lacolaco/blog.lacolaco.net/workflows/deploy-production/badge.svg)

# blog.lacolaco.net

Astro 5.x + Notion CMSによる個人ブログ。Angular技術ブログを中心に、日英バイリンガル対応。

## 開発ガイドライン

詳細な開発ガイドラインは [CLAUDE.md](./CLAUDE.md) を参照してください。

## 自動生成ファイル

**⚠️ 重要: 以下のファイルは自動生成されます。手動で編集しないでください。**

- `src/content/post/**/*.md` - Notionから同期された記事ファイル
- `src/content/post/metadata.json` - Notionメタデータ
- `src/content/tags/tags.json` - タグ定義
- `src/content/categories/categories.json` - カテゴリ定義
- `public/images/**/*` - 記事内画像

詳細は [tools/notion-sync/README.md](./tools/notion-sync/README.md) を参照してください。

## コマンド

```bash
# 開発サーバー起動
pnpm dev

# Notionから記事を同期
pnpm notion-sync

# ビルド
pnpm build

# テスト
pnpm test:tools

# Lint & Format
pnpm lint
pnpm format
```

## デプロイ

- **Production**: `main` ブランチへのpushで自動デプロイ（GCP Cloud Run）
- **Preview**: Pull Requestで自動デプロイ（プレビュー環境）

## アーキテクチャ

- **フレームワーク**: Astro 5.x + React
- **CMS**: Notion
- **スタイリング**: Tailwind CSS 4.x
- **ホスティング**: Google Cloud Run
- **CI/CD**: GitHub Actions