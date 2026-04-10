import { syncNotionDatasource, extractProperty, type PostMetadata, type RenderContext } from '@lacolaco/notion-sync';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

// このdatasourceのextractMetadataが返すメタデータ型
// v10でPostMetadataからpassthroughフィールドが削除されたため、必要なフィールドを自前で定義
type BlogPostMetadata = PostMetadata & {
  icon: string;
  channels: string[];
  locale: string;
  source_url: string;
  category?: string;
  tags: string[];
  canonical_url: string | null;
  created_time: string;
  last_edited_time: string;
};

// features検出用の型定義
type FeatureState = {
  hasMermaid?: boolean;
  hasKatex?: boolean;
  hasTweet?: boolean;
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

const result = await syncNotionDatasource<BlogPostMetadata>({
  notion: {
    token: NOTION_AUTH_TOKEN,
    datasourceId: 'a902ee6d-dc94-4301-b772-fa5fb8decc0c',
  },
  queryFilter: {
    and: [
      { property: 'distribution', multi_select: { contains: 'blog.lacolaco.net' } },
      { property: 'published', checkbox: { equals: true } },
      { property: 'channels', multi_select: { is_not_empty: true } },
    ],
  },
  manifestPath: `${rootDir}/manifest.json`,
  metadataFilePath: `${rootDir}/src/content/post/notion/metadata.json`,
  propertyOutputs: {
    tags: path.resolve(rootDir, 'src/content/post/notion/tags.json'),
    channels: path.resolve(rootDir, 'src/content/post/notion/channels.json'),
  },
  verbose: true,
  mode,
  force,
  dryRun,
  extractMetadata: (page, defaultExtractor) => {
    const metadata = defaultExtractor(page);
    const icon = page.icon && page.icon.type === 'emoji' ? page.icon.emoji : '';
    const updatedAt = extractProperty<string>(page, 'updated_at');
    // v11でextractDate()がcreated_at_overrideを見なくなったため、自前でオーバーライドする
    const createdAtOverride = extractProperty<string>(page, 'created_at_override');
    const createdAtDate = createdAtOverride ? new Date(createdAtOverride) : null;
    const date = createdAtDate && !isNaN(createdAtDate.getTime()) ? createdAtDate : metadata.date;

    return {
      ...metadata,
      date,
      icon,
      channels: extractProperty<string[]>(page, 'channels') ?? [],
      locale: extractProperty<string>(page, 'locale') ?? 'ja',
      source_url: page.url,
      category: extractProperty<string>(page, 'category'),
      tags: extractProperty<string[]>(page, 'tags') ?? [],
      canonical_url: extractProperty<string>(page, 'canonical_url') ?? null,
      created_time: date.toISOString(),
      last_edited_time: new Date(updatedAt ?? page.last_edited_time).toISOString(),
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
    generateFrontmatter: (_baseFields, metadata, renderContext: RenderContext<FeatureState>) => {
      return {
        title: metadata.title,
        slug: metadata.slug,
        icon: metadata.icon,
        created_time: metadata.created_time,
        last_edited_time: metadata.last_edited_time,
        tags: metadata.tags,
        published: true,
        locale: metadata.locale,
        category: metadata.category,
        canonical_url: metadata.canonical_url ?? undefined,
        channels: metadata.channels.length > 0 ? metadata.channels : undefined,
        notion_url: metadata.source_url,
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
