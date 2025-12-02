# notion-sync

Notion CMSからブログコンテンツを同期するツール。[@lacolaco/notion-sync](https://github.com/lacolaco/notion-sync)を使用。

## Overview

- Notionデータベースから記事を取得
- Markdown + frontmatterに変換
- src/content/post/に配置（year/monthディレクトリ構造）
- 画像をpublic/images/に保存
- metadata.json、tags.json、categories.jsonを生成

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

`postPathResolver`で記事のパスを決定：

```
src/content/post/
  2024/
    01/
      my-post.md
      my-post.en.md
    02/
      another-post.md
  2025/
    03/
      new-post.md
```

`created_time`からyear/monthを抽出し、`{year}/{month}/{slug}.md`形式で保存。

## Output

### 生成されるファイル

#### src/content/post/metadata.json

Notion datasourceから取得したメタデータ（@lacolaco/notion-sync@2.3.0以降）：

```json
{
  "posts": {
    "post-slug": "2024-01-01T00:00:00.000Z"
  },
  "tags": [
    {
      "id": "uuid",
      "name": "Angular",
      "color": "red",
      "description": null
    }
  ],
  "categories": [
    {
      "id": "uuid",
      "name": "Tech",
      "color": "blue",
      "description": null
    }
  ]
}
```

#### src/content/tags/tags.json

metadata.jsonから生成される旧フォーマット（色情報付き）：

```json
{
  "Angular": {
    "name": "Angular",
    "color": "red"
  }
}
```

src/libs/post/properties.tsでインポートされ、`Tags` zodスキーマで検証される。

#### src/content/categories/categories.json

metadata.jsonから生成される旧フォーマット（色情報付き）：

```json
{
  "Tech": {
    "name": "Tech",
    "color": "blue"
  }
}
```

src/libs/post/properties.tsでインポートされ、`Categories` zodスキーマで検証される。

## Architecture

### @lacolaco/notion-syncの使い方

```typescript
import { syncNotionBlog, type RenderContext } from '@lacolaco/notion-sync';

await syncNotionBlog({
  // 基本設定
  notionToken: NOTION_AUTH_TOKEN,
  datasourceId: 'database-id',
  distribution: 'blog.lacolaco.net',
  postsDir: './src/content/post',
  imagesDir: './public/images',

  // カスタマイズ
  postPathResolver: (metadata) => {
    // ディレクトリ構造の決定
    const date = new Date(metadata.created_time);
    return `${year}/${month}/${metadata.slug}.md`;
  },

  extractMetadata: (page, defaultExtractor) => {
    // カスタムメタデータの抽出
    const metadata = defaultExtractor(page);
    return { ...metadata, icon: page.icon?.emoji || '' };
  },

  renderMarkdown: {
    blockRenderers: {
      // ブロック毎のカスタムレンダリング
      code: (block, context, defaultRenderer) => {
        // features検出
        if (block.code.language === 'mermaid') {
          context.state.hasMermaid = true;
        }
        return defaultRenderer(block);
      },
    },
    generateFrontmatter: (baseFields, metadata, renderContext) => {
      // frontmatterの生成
      return {
        ...baseFields,
        features: {
          mermaid: renderContext.state.hasMermaid ?? false,
        },
      };
    },
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
