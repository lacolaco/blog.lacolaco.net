import type { CollectionEntry } from 'astro:content';
import yaml from 'yaml';

/**
 * Content Collectionのentryからraw Markdownを取得
 * entry.dataから必要なフィールドのみを選択してFrontmatterを構築し、entry.bodyと結合する
 */
export function readRawMarkdown(entry: CollectionEntry<'postsV2'>): string {
  if (!entry.body) {
    throw new Error(`Entry ${entry.id} has no body`);
  }

  // 記事ページで表示される情報のみを抽出
  const frontmatter = {
    title: entry.data.title,
    slug: entry.data.slug,
    created_time: entry.data.created_time,
    last_edited_time: entry.data.last_edited_time,
    category: entry.data.category,
    tags: entry.data.tags,
    published: entry.data.published,
    locale: entry.data.locale,
  };

  const frontmatterYaml = yaml.stringify(frontmatter);

  // Frontmatter + body を結合
  return `---\n${frontmatterYaml}---\n${entry.body}`;
}
