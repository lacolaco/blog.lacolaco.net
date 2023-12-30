import { BlogDatabaseProperties } from '@lib/notion';
import { Categories, Tags } from '@lib/post';

export function toTagsJSON(config: BlogDatabaseProperties['tags']): Tags {
  const tags = config.multi_select.options.map((option) => [option.name, { name: option.name, color: option.color }]);

  return Tags.parse(Object.fromEntries(tags));
}

export function toCategoriesJSON(config: BlogDatabaseProperties['category']): Categories {
  const categories = config.select.options.map((option) => [option.name, { name: option.name, color: option.color }]);

  return Categories.parse(Object.fromEntries(categories));
}
