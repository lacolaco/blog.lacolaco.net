import * as prettier from 'prettier';
import { transformNotionBlocksToMarkdown } from './block-transformer';
import type { PageObject, UntypedBlockObject } from './notion-types';

/**
 * NotionページをフロントマターとMarkdownコンテンツに変換する純粋関数
 */
export async function transformNotionPageToMarkdown(page: PageObject): Promise<{
  slug: string;
  markdown: string;
  imageDownloads: Array<{ filename: string; url: string }>;
}> {
  const frontmatter = extractFrontmatter(page);
  const frontmatterString = formatFrontmatter(frontmatter);

  // ページにchildrenプロパティがある場合（ブロックが含まれている場合）はそれを変換
  const pageWithChildren = page as PageObject & { children?: UntypedBlockObject[] };
  const context = {
    slug: frontmatter.slug,
    imageDownloads: [],
  };
  const content = pageWithChildren.children ? transformNotionBlocksToMarkdown(pageWithChildren.children, context) : '';

  const markdown = `---
${frontmatterString}
---

${content}`;

  const config = await prettier.resolveConfig(new URL('.', import.meta.url), { useCache: false });
  if (config == null) {
    throw new Error('Prettier configuration not found');
  }
  const formattedMarkdown = await prettier.format(markdown, { parser: 'markdown', ...config });
  return {
    slug: frontmatter.slug,
    markdown: formattedMarkdown,
    imageDownloads: context.imageDownloads,
  };
}

function formatFrontmatter(frontmatter: BlogPostFrontmatter): string {
  return Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map((v) => `'${v}'`).join(', ')}]`;
      }
      if (typeof value === 'string' && needsQuotes(key)) {
        return `${key}: '${value}'`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');
}

function needsQuotes(key: string): boolean {
  return ['icon', 'created_time', 'last_edited_time', 'category', 'notion_url'].includes(key);
}

interface BlogPostFrontmatter {
  title: string;
  slug: string;
  icon: string;
  created_time: string;
  last_edited_time: string;
  category: string;
  tags: string[];
  published: boolean;
  notion_url: string;
  locale?: string;
}

function extractFrontmatter(page: PageObject): BlogPostFrontmatter {
  const properties = page.properties;

  // タイトルの抽出
  const titleProp = properties.title;
  const title = 'title' in titleProp ? titleProp.title[0]?.plain_text || '' : '';

  // スラッグの抽出
  const slugProp = properties.slug;
  const slug = 'rich_text' in slugProp ? slugProp.rich_text[0]?.plain_text || '' : '';

  // ロケールの抽出
  const localeProp = properties.locale;
  const locale = 'select' in localeProp ? localeProp.select?.name || 'ja' : 'ja';

  // カテゴリの抽出
  const categoryProp = properties.category;
  const category = 'select' in categoryProp ? categoryProp.select?.name || '' : '';

  // タグの抽出
  const tagsProp = properties.tags;
  const tags = 'multi_select' in tagsProp ? tagsProp.multi_select.map((tag) => tag.name) : [];

  // 公開フラグの抽出
  const publishedProp = properties.published;
  const published = 'checkbox' in publishedProp ? publishedProp.checkbox : false;

  // アイコンの抽出
  const icon = page.icon && 'emoji' in page.icon ? page.icon.emoji : '';

  const notion_url = page.url;

  const result: BlogPostFrontmatter = {
    title,
    slug: locale === 'ja' ? slug : `${slug}.${locale}`,
    icon,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    category,
    tags,
    published,
    notion_url,
  };

  return result;
}
