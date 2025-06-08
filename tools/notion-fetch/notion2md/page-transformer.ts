import * as prettier from 'prettier';
import { transformNotionBlocksToMarkdown } from './block-transformer';
import type { PageObject, UntypedBlockObject } from '../notion-types';

/**
 * NotionページをフロントマターとMarkdownコンテンツに変換する純粋関数
 */
export async function transformNotionPageToMarkdown(page: PageObject): Promise<{
  filename: string;
  markdown: string;
}> {
  const frontmatter = extractFrontmatter(page);
  const frontmatterString = formatFrontmatter(frontmatter);

  // ページにchildrenプロパティがある場合（ブロックが含まれている場合）はそれを変換
  const pageWithChildren = page as PageObject & { children?: UntypedBlockObject[] };
  const content = pageWithChildren.children ? transformNotionBlocksToMarkdown(pageWithChildren.children) : '';

  const markdown = `---
${frontmatterString}
---

${content}`;

  const config = await prettier.resolveConfig(new URL('../..', import.meta.url));
  const formattedMarkdown = await prettier.format(markdown, { parser: 'markdown', ...config });
  return {
    filename: `${frontmatter.slug}.md`,
    markdown: formattedMarkdown,
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
  const title = titleProp && 'title' in titleProp ? titleProp.title?.[0]?.plain_text || '' : '';

  // スラッグの抽出
  const slugProp = properties.slug;
  const slug = slugProp && 'rich_text' in slugProp ? slugProp.rich_text?.[0]?.plain_text || '' : '';

  // ロケールの抽出
  const localeProp = properties.locale;
  const locale = localeProp && 'select' in localeProp ? localeProp.select?.name || 'ja' : 'ja';

  // カテゴリの抽出
  const categoryProp = properties.category;
  const category = categoryProp && 'select' in categoryProp ? categoryProp.select?.name || '' : '';

  // タグの抽出
  const tagsProp = properties.tags;
  const tags = tagsProp && 'multi_select' in tagsProp ? tagsProp.multi_select?.map((tag) => tag.name) || [] : [];

  // 公開フラグの抽出
  const publishedProp = properties.published;
  const published = publishedProp && 'checkbox' in publishedProp ? publishedProp.checkbox || false : false;

  // アイコンの抽出
  const icon = page.icon && 'emoji' in page.icon ? page.icon.emoji : '';

  // Notion URLの生成
  const pageTitle = title.replace(/\s+/g, '-');
  const notion_url = `https://www.notion.so/${pageTitle}-${page.id.replace(/-/g, '')}`;

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
