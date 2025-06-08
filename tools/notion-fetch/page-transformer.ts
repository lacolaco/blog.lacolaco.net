import * as prettier from 'prettier';
import { transformNotionBlocksToMarkdown, type TransformContext } from './block-transformer';
import { formatFrontmatter } from './frontmatter';
import type { BlogPostFrontmatter } from './blog-types';
import type { PageObject, UntypedBlockObject } from './notion-types';

/**
 * ページからコンテンツを生成する純粋関数
 */
export function generateContent(page: PageObject, context: TransformContext): string {
  // ページにchildrenプロパティがある場合（ブロックが含まれている場合）はそれを変換
  const pageWithChildren = page as PageObject & { children?: UntypedBlockObject[] };
  return pageWithChildren.children ? transformNotionBlocksToMarkdown(pageWithChildren.children, context) : '';
}

/**
 * フロントマターオブジェクトと本文を受け取ってMarkdownファイル全体を構築する純粋関数
 */
export async function buildMarkdownFile(frontmatter: BlogPostFrontmatter, content: string): Promise<string> {
  const frontmatterString = formatFrontmatter(frontmatter);
  const markdown = `---
${frontmatterString}
---

${content}`;

  const config = await prettier.resolveConfig(new URL('.', import.meta.url), { useCache: false });
  if (config == null) {
    throw new Error('Prettier configuration not found');
  }
  return await prettier.format(markdown, { parser: 'markdown', ...config });
}

export function extractFrontmatter(page: PageObject): BlogPostFrontmatter {
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
