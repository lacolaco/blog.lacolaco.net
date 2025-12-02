import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { syncNotionBlog, type RenderContext } from '@lacolaco/notion-sync';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// features検出用の型定義
type FeatureState = {
  hasMermaid?: boolean;
  hasKatex?: boolean;
  hasTweet?: boolean;
};

// メタデータの型定義
type CustomMetadata = {
  created_time: string;
  slug: string;
  icon: string;
  [key: string]: unknown;
};

// metadata.jsonの型定義
type MetadataJson = {
  posts: Record<string, string>;
  tags: Array<{
    id: string;
    name: string;
    color: string;
    description: string | null;
  }>;
  categories: Array<{
    id: string;
    name: string;
    color: string;
    description: string | null;
  }>;
};

const { NOTION_AUTH_TOKEN } = process.env;
if (!NOTION_AUTH_TOKEN) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}

// CLIオプションの解析
// tsxが`--`を引数として渡すため、それを除外
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const { values } = parseArgs({
  args,
  allowPositionals: false,
  strict: true,
  options: {
    force: {
      type: 'boolean',
      default: false,
    },
    mode: {
      type: 'string',
      default: 'incremental',
    },
  },
});

const force = values.force;
const mode: 'all' | 'incremental' = values.mode === 'all' ? 'all' : 'incremental';

const rootDir = new URL('../..', import.meta.url).pathname;

const result = await syncNotionBlog({
  notionToken: NOTION_AUTH_TOKEN,
  datasourceId: 'a902ee6d-dc94-4301-b772-fa5fb8decc0c',
  distribution: 'blog.lacolaco.net',
  postsDir: `${rootDir}/src/content/post`,
  imagesDir: `${rootDir}/public/images`,
  manifestPath: `${rootDir}/manifest.json`,
  verbose: true,
  mode,
  force,
  postPathResolver: (metadata) => {
    const customMetadata = metadata as CustomMetadata;
    const date = new Date(customMetadata.created_time);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}/${month}/${customMetadata.slug}.md`;
  },
  extractMetadata: (page, defaultExtractor) => {
    const metadata = defaultExtractor(page);
    const pageObject = page as PageObjectResponse;
    const icon = pageObject.icon && pageObject.icon.type === 'emoji' ? pageObject.icon.emoji : '';
    return {
      ...metadata,
      icon,
    } as CustomMetadata;
  },
  renderMarkdown: {
    blockRenderers: {
      // Mermaid図の検出
      code: (block, context: RenderContext<FeatureState>, defaultRenderer) => {
        const language = block.code.language;
        if (language === 'mermaid') {
          context.state.hasMermaid = true;
        }
        return defaultRenderer(block);
      },
      // ブロック数式の検出
      equation: (block, context: RenderContext<FeatureState>, defaultRenderer) => {
        context.state.hasKatex = true;
        return defaultRenderer(block);
      },
      // インライン数式と全ブロックからのtwitter URL検出
      paragraph: (block, context: RenderContext<FeatureState>, defaultRenderer) => {
        // インライン数式の検出（$で囲まれた数式）
        const containsEquation = block.paragraph.rich_text.some((rt) => rt.type === 'equation');
        if (containsEquation) {
          context.state.hasKatex = true;
        }
        // Tweet URLの検出
        const containsTwitterLink = block.paragraph.rich_text.some((rt) => {
          if (rt.href) {
            return rt.href.includes('twitter.com') || rt.href.includes('x.com');
          }
          return false;
        });
        if (containsTwitterLink) {
          context.state.hasTweet = true;
        }
        return defaultRenderer(block);
      },
      // Tweet埋め込みの検出（embedブロック）
      embed: (block, context: RenderContext<FeatureState>, defaultRenderer) => {
        if (block.embed.url.includes('twitter.com') || block.embed.url.includes('x.com')) {
          context.state.hasTweet = true;
        }
        return defaultRenderer(block);
      },
      // Tweet埋め込みの検出（bookmarkブロック）
      bookmark: (block, context: RenderContext<FeatureState>, defaultRenderer) => {
        if (block.bookmark.url.includes('twitter.com') || block.bookmark.url.includes('x.com')) {
          context.state.hasTweet = true;
        }
        return defaultRenderer(block);
      },
      // Tweet埋め込みの検出（link_previewブロック）
      link_preview: (block, context: RenderContext<FeatureState>, defaultRenderer) => {
        if (block.link_preview.url.includes('twitter.com') || block.link_preview.url.includes('x.com')) {
          context.state.hasTweet = true;
        }
        return defaultRenderer(block);
      },
    },
    generateFrontmatter: (baseFields, metadata, renderContext: RenderContext<FeatureState>) => {
      const customMetadata = metadata as CustomMetadata;
      const { source_url, title, slug, ...rest } = baseFields as Record<string, unknown>;

      return {
        title,
        slug,
        icon: customMetadata.icon,
        ...rest,
        notion_url: source_url,
        features: {
          katex: renderContext.state.hasKatex ?? false,
          mermaid: renderContext.state.hasMermaid ?? false,
          tweet: renderContext.state.hasTweet ?? false,
        },
      };
    },
  },
});

console.log('Sync completed:', result);

// metadata.jsonから tags.json と categories.json を生成
const metadataJson = JSON.parse(await readFile(`${rootDir}/src/content/post/metadata.json`, 'utf-8')) as MetadataJson;

// tags.json生成
const tagsData = Object.fromEntries(metadataJson.tags.map((tag) => [tag.name, { name: tag.name, color: tag.color }]));
await writeFile(`${rootDir}/src/content/tags/tags.json`, JSON.stringify(tagsData, null, 2) + '\n');
console.log('Generated tags.json');

// categories.json生成
const categoriesData = Object.fromEntries(
  metadataJson.categories.map((category) => [category.name, { name: category.name, color: category.color }]),
);
await writeFile(`${rootDir}/src/content/categories/categories.json`, JSON.stringify(categoriesData, null, 2) + '\n');
console.log('Generated categories.json');
