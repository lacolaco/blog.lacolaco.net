import { BlogDatabaseProperties } from '@lib/notion';
import { Tags } from '@lib/post';

export function toTagsJSON(config: BlogDatabaseProperties['tags']): Tags {
  const tags = config.multi_select.options.map((option) => [option.name, { name: option.name, color: option.color }]);

  return Object.fromEntries(tags);
}
