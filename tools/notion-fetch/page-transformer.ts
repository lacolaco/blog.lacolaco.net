import assert from 'node:assert';
import * as prettier from 'prettier';
import { transformNotionBlocksToMarkdown, toPlainText, type TransformContext } from './block-transformer';
import { formatFrontmatter } from './frontmatter';
import { PostFrontmatter, type PostFrontmatterOut } from '@lib/post';
import type { BlockObject, BlogPageObject } from '@lacolaco/notion-db';

/**
 * ページからコンテンツを生成する純粋関数
 */
export function generateContent(childBlocks: BlockObject[], context: TransformContext): string {
  return transformNotionBlocksToMarkdown(childBlocks, context);
}

/**
 * フロントマターオブジェクトと本文を受け取ってMarkdownファイル全体を構築する純粋関数
 */
export async function buildMarkdownFile(
  frontmatter: PostFrontmatterOut,
  content: string,
  context: TransformContext,
): Promise<string> {
  // context の features をフロントマターに反映
  frontmatter.features = context.features;

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

export function extractFrontmatter(page: BlogPageObject): PostFrontmatterOut {
  const properties = page.properties;

  // タイトルの抽出
  const titleProp = properties.title;
  const title = toPlainText(titleProp.title);
  assert(title, 'Title is required');

  // スラッグの抽出
  const slugProp = properties.slug;
  const slug = toPlainText(slugProp.rich_text);
  assert(slug, 'Slug is required');

  // 作成日時の抽出
  const createdTimeProp = properties.created_at_override;
  const createdTime = createdTimeProp.date?.start || page.created_time;

  // 更新日時の抽出
  const updatedTimeProp = properties.updated_at;
  const updatedTime = updatedTimeProp.date?.start || page.last_edited_time;

  // ロケールの抽出
  const localeProp = properties.locale;
  const locale = localeProp.select?.name || 'ja';

  // カテゴリの抽出
  const categoryProp = properties.category;
  const category = categoryProp.select?.name || '';

  // タグの抽出
  const tagsProp = properties.tags;
  const tags = 'multi_select' in tagsProp ? tagsProp.multi_select.map((tag) => tag.name) : [];

  // 公開フラグの抽出
  const publishedProp = properties.published;
  const published = publishedProp.checkbox;

  // アイコンの抽出
  const icon = page.icon && 'emoji' in page.icon ? page.icon.emoji : '';

  // canonical URLの抽出
  const canonicalUrlProp = properties.canonical_url;
  const canonicalUrl = canonicalUrlProp.url;

  const notion_url = page.url;

  const frontmatter = PostFrontmatter.parse({
    title,
    slug: locale === 'ja' ? slug : `${slug}.${locale}`,
    icon,
    created_time: createdTime,
    last_edited_time: updatedTime,
    category,
    tags,
    published,
    locale,
    canonical_url: canonicalUrl ?? undefined,
    notion_url,
  });

  return frontmatter;
}
