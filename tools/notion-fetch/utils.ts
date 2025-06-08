import { format } from 'prettier';
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
