import notionTagsJson from '../../content/post/notion/tags.json';
import notionCategoriesJson from '../../content/post/notion/categories.json';
import manualTagsJson from '../../content/post/tags.json';
import manualCategoriesJson from '../../content/post/categories.json';
import { Tag, Tags, Category, Categories } from './schema';

// マージ: 親ディレクトリ（manual）が同名エントリを上書き
export function mergeByName<T extends { name: string }>(base: T[], override: T[]): T[] {
  const map = new Map(base.map((item) => [item.name, item]));
  for (const item of override) {
    map.set(item.name, item);
  }
  return Array.from(map.values());
}

export const tags = Tags.parse(mergeByName(notionTagsJson as Tag[], manualTagsJson as Tag[]));

export function getTagByName(name: string): Tag | undefined {
  return tags.find((tag) => tag.name === name);
}

export const categories = Categories.parse(
  mergeByName(notionCategoriesJson as Category[], manualCategoriesJson as Category[]),
);

export function getCategoryByName(name: string): Category | undefined {
  return categories.find((category) => category.name === name);
}
