import { format } from 'prettier';
import * as YAML from 'yaml';
import { type BlogDatabaseProperties } from '@lib/notion';
import { Categories, Tags } from '@lib/post';

/**
 * JSON データを Prettier でフォーマットする純粋関数
 */
export async function formatJSON(data: unknown): Promise<string> {
  return await format(JSON.stringify(data, null, 2), {
    parser: 'json',
  });
}

/**
 * Notion データベースのタグプロパティを Tags オブジェクトに変換する純粋関数
 */
export function toTagsJSON(config: BlogDatabaseProperties['tags']): Tags {
  const tags = config.multi_select.options.map((option) => [option.name, { name: option.name, color: option.color }]);
  return Tags.parse(Object.fromEntries(tags));
}

/**
 * Notion データベースのカテゴリプロパティを Categories オブジェクトに変換する純粋関数
 */
export function toCategoriesJSON(config: BlogDatabaseProperties['category']): Categories {
  const categories = config.select.options.map((option) => [option.name, { name: option.name, color: option.color }]);
  return Categories.parse(Object.fromEntries(categories));
}

/**
 * Markdownファイルからフロントマターを抽出する純粋関数
 * yaml ライブラリを使用してフロントマターをパース
 */
export function parseFrontmatter(markdown: string): Record<string, unknown> | null {
  // フロントマターのパターンマッチング（空のフロントマターにも対応）
  const frontmatterRegex = /^---\n?([\s\S]*?)\n?---/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatterContent = match[1];

  // 空のフロントマターの場合は空オブジェクトを返す
  if (!frontmatterContent.trim()) {
    return {};
  }

  try {
    // yamlライブラリを使用してパース
    const parsed = YAML.parse(frontmatterContent.trim()) as unknown;
    // parseYamlがnullを返す場合は空オブジェクトを返す
    if (parsed === null) {
      return {};
    }
    // オブジェクト型であることを確認
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    // オブジェクト以外の場合はnullを返す
    return null;
  } catch {
    // パースに失敗した場合はnullを返す
    return null;
  }
}

/**
 * NotionページとMarkdownフロントマターの最終編集時間を比較して処理をスキップするかどうかを判定する純粋関数
 */
export function shouldSkipProcessing(
  notionLastEditedTime: string,
  frontmatter: Record<string, unknown> | null,
): boolean {
  // フロントマターがnullまたは存在しない場合はfalse
  if (!frontmatter) {
    return false;
  }

  // フロントマターにlast_edited_timeが存在しない場合はfalse
  if (!frontmatter.last_edited_time || typeof frontmatter.last_edited_time !== 'string') {
    return false;
  }

  // NotionのlastEditedTimeが空文字列の場合はfalse
  if (!notionLastEditedTime.trim()) {
    return false;
  }

  // 最終編集時間が一致する場合はtrue（スキップ）
  return notionLastEditedTime === frontmatter.last_edited_time;
}
