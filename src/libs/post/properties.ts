import tagsJson from '../../content/post/tags.json';
import { Tag, Tags } from './schema';
import categoriesJson from '../../content/post/categories.json';
import { Category, Categories } from './schema';

export const tags = Tags.parse(tagsJson);

export function getTagByName(name: string): Tag | undefined {
  return tags.find((tag) => tag.name === name);
}

export const categories = Categories.parse(categoriesJson);

export function getCategoryByName(name: string): Category | undefined {
  return categories.find((category) => category.name === name);
}
