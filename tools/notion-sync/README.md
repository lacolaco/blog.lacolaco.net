# notion-sync

Notion CMSからブログコンテンツを同期するツール。[@lacolaco/notion-sync](https://github.com/lacolaco/notion-sync)を使用。

## Overview

- Notionデータベースから記事を取得
- Markdown + frontmatterに変換
- `src/content/post/notion/` に `{slug}.md`（locale=ja）または `{slug}.en.md`（locale=en）として配置
- 画像を `public/images/{slug}/` に保存
- `tags.json`、`channels.json` をNotion DBプロパティから生成

## Usage

### 基本的な使い方

```bash
# 差分同期（デフォルト）
pnpm notion-sync

# すべての記事を再同期
pnpm notion-sync -- --mode=all

# すべての記事を強制再生成
pnpm notion-sync -- --mode=all --force
```

### CLIオプション

- `--mode=<incremental|all>`: 同期モード（デフォルト: incremental）
  - `incremental`: manifest.jsonのlastModifiedを元に差分同期
  - `all`: すべての記事を取得
- `--force`: ファイルを強制的に再生成（manifest無視）

### 環境変数

- `NOTION_AUTH_TOKEN`: Notion Integration Token（必須）

## Customization

### Features検出

記事で使用されている機能を自動検出し、frontmatterに追加：

- **mermaid**: Mermaid図（言語がmermaidのコードブロック）
- **katex**: 数式（equationブロック、インライン数式）
- **tweet**: Twitter埋め込み（embed、bookmark、link_preview、段落内のリンク）

検出結果は`features`フィールドに格納：

```yaml
features:
  katex: false
  mermaid: false
  tweet: false
```

### Icon抽出

Notion pageのemojiアイコンを`icon`フィールドとして抽出：

```yaml
icon: 📝
```

PostNavigation.astroで使用。

### ディレクトリ構造

`getPageOutput`で記事のパスを決定：

```
src/content/post/notion/
  my-post.md
  my-post.en.md
  another-post.md
  new-post.md
```

フラット構造。localeが`en`の場合のみ`.en.md`サフィックスが付く。

## Output

### 生成されるファイル

#### src/content/post/notion/tags.json

Notion DBの`tags`プロパティ（multi_select）のオプション一覧。`propertyOutputs`により出力される：

```json
[
  {
    "id": "uuid",
    "name": "Angular",
    "color": "red",
    "description": null
  }
]
```

`src/libs/post/properties.ts`でインポートされ、`Tags` zodスキーマで検証される。

#### src/content/post/notion/channels.json

同じくNotion DBの`channels`プロパティ（multi_select）のオプション一覧。

## Architecture

### @lacolaco/notion-syncの使い方

```typescript
import { syncNotionDatasource, type EntryMetadata, type RenderContext } from '@lacolaco/notion-sync';

// Notion DBプロパティのスキーマ。get(name)の戻り値型をここで定義する
type BlogPostDatasource = {
  title: string;
  date: Date;
  slug: string | undefined;
  channels: string[] | undefined;
  // ... Notion DB propertyの型
};

// v13でslugがEntryMetadataから削除されたため、consumer側でslugを持つ型を定義する
type BlogPostMetadata = EntryMetadata & {
  slug: string;
  icon: string;
  channels: string[];
  // ... consumer-specific fields
};

await syncNotionDatasource<BlogPostMetadata, BlogPostDatasource>({
  notion: {
    token: NOTION_AUTH_TOKEN,
    datasourceId: 'database-id',
  },
  queryFilter: {
    and: [{ property: 'distribution', multi_select: { contains: 'blog.lacolaco.net' } }],
  },
  propertyOutputs: {
    tags: './src/content/post/notion/tags.json',
    channels: './src/content/post/notion/channels.json',
  },

  // v13: (page, get)シグネチャ。getは型安全なプロパティアクセサ
  extractMetadata: (page, get) => ({
    title: get('title'),
    date: get('date'),
    slug: get('slug') ?? page.id,
    icon: page.icon?.type === 'emoji' ? page.icon.emoji : '',
    channels: get('channels') ?? [],
  }),

  renderMarkdown: {
    getPageOutput: (metadata) => ({
      filePath: `./src/content/post/notion/${metadata.slug}.md`,
    }),
    getImageOutput: (image, metadata) => ({
      src: `/images/${metadata.slug}/${image.blockId}.png`,
      filePath: `./public/images/${metadata.slug}/${image.blockId}.png`,
    }),
    blockRenderers: {
      code: (block, context, defaultRenderer) => {
        if (block.code.language === 'mermaid') {
          context.state.hasMermaid = true;
        }
        return defaultRenderer(block);
      },
    },
    generateFrontmatter: (_baseFields, metadata, renderContext) => ({
      title: metadata.title,
      slug: metadata.slug,
      features: {
        mermaid: renderContext.state.hasMermaid ?? false,
      },
    }),
  },
});
```

### 型安全な状態管理

`RenderContext<T>`で型安全な共有状態を実現：

```typescript
type FeatureState = {
  hasMermaid?: boolean;
  hasKatex?: boolean;
  hasTweet?: boolean;
};

// blockRenderers内で型安全にアクセス
code: (block, context: RenderContext<FeatureState>, defaultRenderer) => {
  context.state.hasMermaid = true; // 型チェックされる
  return defaultRenderer(block);
};
```

## References

- [@lacolaco/notion-sync](https://github.com/lacolaco/notion-sync)
- [Notion API](https://developers.notion.com/)
