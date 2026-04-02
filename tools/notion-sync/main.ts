import { syncNotionDatasource, type PostMetadata, type RenderContext } from '@lacolaco/notion-sync';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

// このdatasourceのextractMetadataが返すメタデータ型
type BlogPostMetadata = PostMetadata & { icon: string; channels: string[] };

// features検出用の型定義
type FeatureState = {
  hasMermaid?: boolean;
  hasKatex?: boolean;
  hasTweet?: boolean;
};

// Notion APIのpropertiesからmulti_selectの名前配列を安全に取得する
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
function extractMultiSelectNames(properties: object, key: string): string[] {
  if (!(key in properties)) return [];
  const prop = (properties as any)[key];
  if (prop == null || typeof prop !== 'object' || prop.type !== 'multi_select') return [];
  if (!Array.isArray(prop.multi_select)) return [];
  return prop.multi_select.map((item: { name: string }) => item.name);
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

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
    'dry-run': {
      type: 'boolean',
      default: false,
    },
  },
});

const force = values.force;
const mode: 'all' | 'incremental' = values.mode === 'all' ? 'all' : 'incremental';
const dryRun = values['dry-run'];

const rootDir = new URL('../..', import.meta.url).pathname;

const result = await syncNotionDatasource({
  notion: {
    token: NOTION_AUTH_TOKEN,
    datasourceId: 'a902ee6d-dc94-4301-b772-fa5fb8decc0c',
  },
  queryFilter: { property: 'distribution', multi_select: { contains: 'blog.lacolaco.net' } },
  manifestPath: `${rootDir}/manifest.json`,
  metadataFilePath: `${rootDir}/src/content/post/notion/metadata.json`,
  propertyOutputs: {
    tags: path.resolve(rootDir, 'src/content/post/notion/tags.json'),
    category: path.resolve(rootDir, 'src/content/post/notion/categories.json'),
  },
  verbose: true,
  mode,
  force,
  dryRun,
  filterPost: (metadata) => {
    const m = metadata as BlogPostMetadata;
    return m.published && m.channels.length > 0;
  },
  extractMetadata: (page, defaultExtractor) => {
    const metadata = defaultExtractor(page);
    const icon = page.icon && page.icon.type === 'emoji' ? page.icon.emoji : '';

    // channels マルチセレクトの読み取り
    let channels: string[] = [];
    try {
      channels = extractMultiSelectNames(page.properties, 'channels');
    } catch {
      // channelsプロパティが存在しない場合は空配列
    }

    return {
      ...metadata,
      icon,
      channels,
    };
  },
  renderMarkdown: {
    getPageOutput: (metadata) => {
      const localeSuffix = metadata.locale === 'en' ? '.en' : '';
      return {
        filePath: path.resolve(rootDir, 'src/content/post/notion', `${metadata.slug}${localeSuffix}.md`),
      };
    },
    getImageOutput: (image, metadata) => {
      // Notion URLからファイル名を抽出し、URLデコード→NFC正規化
      const rawSegment = image.url.split('?')[0].split('#')[0].split('/').pop() ?? '';
      const nfcFilename = decodeURIComponent(rawSegment).normalize('NFC');
      const dotIndex = nfcFilename.lastIndexOf('.');
      const name = dotIndex > 0 ? nfcFilename.substring(0, dotIndex) : nfcFilename;
      const ext = dotIndex > 0 ? nfcFilename.substring(dotIndex + 1).toLowerCase() : 'png';
      const hash = createHash('sha256').update(image.blockId).digest('hex').substring(0, 16);
      const diskFilename = `${name}.${hash}.${ext}`;
      // srcはURLエンコード（既存markdownとの互換性維持）、filePathはデコード済みNFC
      const encodedFilename = `${encodeURIComponent(name)}.${hash}.${ext}`;
      return {
        src: `/images/${metadata.slug}/${encodedFilename}`,
        filePath: path.resolve(rootDir, 'public/images', metadata.slug, diskFilename),
      };
    },
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
      const { source_url, title, slug, ...rest } = baseFields as Record<string, unknown>;
      const ext = metadata as BlogPostMetadata;

      return {
        title,
        slug,
        icon: ext.icon,
        ...rest,
        channels: ext.channels.length > 0 ? ext.channels : undefined,
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
