import { Tag } from '../post/schema';
import { tags } from '../post/properties';

export function queryTags(): Tag[] {
  return Object.values(tags);
}
