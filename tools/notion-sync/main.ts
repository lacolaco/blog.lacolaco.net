import { syncNotionDatasource, type EntryMetadata, type RenderContext } from '@lacolaco/notion-sync';
import { Client, isFullPage } from '@notionhq/client';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

// Notion DBプロパティのスキーマ。get(name)の戻り値型をここで定義する
type BlogPostDatasource = {
  title: string;
  date: Date;
  slug: string | undefined;
  channels: string[] | undefined;
  locale: string | undefined;
  tags: string[] | undefined;
  canonical_url: string | undefined;
  updated_at: string | undefined;
  created_at_override: string | undefined;
};

// このdatasourceのextractMetadataが返すメタデータ型
// v10でpassthroughフィールドが、v13でslugがEntryMetadataから削除されたため自前で定義
type BlogPostMetadata = EntryMetadata & {
  slug: string;
  icon: string;
  channels: string[];
  locale: string;
  source_url: string;
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
const DATASOURCE_ID = 'a902ee6d-dc94-4301-b772-fa5fb8decc0c';

// 自動生成slug: created_time を JST の yyyyMMddHHmmss へ変換した冪等値
// 生成方式の根拠:
// - Notion非依存（created_timeはISO文字列、Notion離脱後も利用可能）
// - 冪等（同じcreated_time → 同じslug）
// - URL可読（日付がURLに現れる）
// - v12時代の先例
// - Japanese title slugify問題を回避
function generateSlugFromCreatedTime(createdTimeIso: string): string {
  return format(new TZDate(createdTimeIso, 'Asia/Tokyo'), 'yyyyMMddHHmmss');
}

// sync前処理: Notion側slugが空のページに自動生成slugを書き戻す。
// Notionを単一の情報源にすることで、以後のmanifest/Notion間の乖離を防ぐ。
async function backfillMissingSlugs(): Promise<void> {
  if (dryRun) {
    console.log('[slug-backfill] dry-run mode: skipping');
    return;
  }
  const notion = new Client({ auth: NOTION_AUTH_TOKEN, notionVersion: '2025-09-03' });
  const targets: { pageId: string; title: string; generatedSlug: string }[] = [];
  let cursor: string | undefined;
  do {
    // @ts-expect-error - notionhq v5のdatasourcesクエリ型未エクスポート
    const response = await notion.dataSources.query({
      data_source_id: DATASOURCE_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const p of response.results) {
      if (!isFullPage(p)) continue;
      const slugProp = p.properties.slug;
      if (slugProp.type !== 'rich_text') continue;
      if (slugProp.rich_text.length > 0) continue;
      const titleProp = p.properties.title;
      const title = titleProp.type === 'title' ? titleProp.title.map((t) => t.plain_text).join('') : '(untitled)';
      const generatedSlug = generateSlugFromCreatedTime(p.created_time);
      targets.push({ pageId: p.id, title, generatedSlug });
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  if (targets.length === 0) {
    console.log('[slug-backfill] no empty slug pages');
    return;
  }
  console.log(`[slug-backfill] writing generated slug for ${targets.length} pages...`);
  // Notion APIのレート制限（約3 req/sec）対策
  const RATE_LIMIT_SLEEP_MS = 350;
  for (const { pageId, title, generatedSlug } of targets) {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        slug: {
          rich_text: [{ type: 'text', text: { content: generatedSlug } }],
        },
      },
    });
    console.log(`[slug-backfill]   ✓ ${pageId} "${title}" <- "${generatedSlug}"`);
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_SLEEP_MS));
  }
}

await backfillMissingSlugs();

const result = await syncNotionDatasource<BlogPostMetadata, BlogPostDatasource>({
  notion: {
    token: NOTION_AUTH_TOKEN,
    datasourceId: DATASOURCE_ID,
  },
  queryFilter: {
    and: [
      { property: 'distribution', multi_select: { contains: 'blog.lacolaco.net' } },
      { property: 'published', checkbox: { equals: true } },
      { property: 'channels', multi_select: { is_not_empty: true } },
    ],
  },
  manifestPath: `${rootDir}/manifest.json`,
  propertyOutputs: {
    tags: path.resolve(rootDir, 'src/content/post/notion/tags.json'),
    channels: path.resolve(rootDir, 'src/content/post/notion/channels.json'),
  },
  verbose: true,
  mode,
  force,
  dryRun,
  extractMetadata: (page, get) => {
    // TSchemaに定義したプロパティはget(name)で型推論される。ただしオブジェクトリテラル右辺での直接利用は
    // コンテキスト型によって`undefined`が消えるため、中間constで受けてから組み立てる
    const title = get('title');
    const baseDate = get('date');
    const slugValue = get('slug');
    const channels = get('channels');
    const locale = get('locale');
    const tags = get('tags');
    const canonicalUrl = get('canonical_url');
    const updatedAt = get('updated_at');
    const createdAtOverride = get('created_at_override');

    const icon = page.icon && page.icon.type === 'emoji' ? page.icon.emoji : '';
    // Notion DBのslugプロパティが未設定の場合はcreated_timeから自動生成する（sync前のbackfillで
    // 通常埋められるが、dry-runやbackfill失敗時の安全網として同じ生成関数でフォールバック）
    const slug = slugValue ?? generateSlugFromCreatedTime(page.created_time);
    // v11でextractDate()がcreated_at_overrideを見なくなったため、自前でオーバーライドする
    const createdAtDate = createdAtOverride ? new Date(createdAtOverride) : null;
    // baseDate（= get('date')）が Invalid Date の場合の防御的フォールバック
    const date =
      createdAtDate && !isNaN(createdAtDate.getTime())
        ? createdAtDate
        : !isNaN(baseDate.getTime())
          ? baseDate
          : new Date(page.created_time);
    // last_edited_timeは更新日プロパティを優先し、不正値なら組み込みのpage.last_edited_timeにフォールバック
    const updatedAtDate = updatedAt ? new Date(updatedAt) : null;
    const lastEditedTime =
      updatedAtDate && !isNaN(updatedAtDate.getTime()) ? updatedAtDate : new Date(page.last_edited_time);

    return {
      title,
      date,
      slug,
      icon,
      channels: channels ?? [],
      locale: locale ?? 'ja',
      source_url: page.url,
      tags: tags ?? [],
      canonical_url: canonicalUrl ?? null,
      created_time: date.toISOString(),
      last_edited_time: lastEditedTime.toISOString(),
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
