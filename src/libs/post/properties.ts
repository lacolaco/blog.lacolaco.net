import tagsJson from '../../content/tags/tags.json';
import { Tag, Tags } from './schema';
import categoriesJson from '../../content/categories/categories.json';
import { Category, Categories } from './schema';

export const tags = Tags.parse(tagsJson);

export function getTagByName(name: string): Tag | undefined {
  return tags[name];
}

export const categories = Categories.parse(categoriesJson);

export function getCategoryByName(name: string): Category | undefined {
  return categories[name];
}
