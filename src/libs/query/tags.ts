import { Tag } from '../post/schema';
import { tags } from '../post/properties';

export async function queryTags(): Promise<Tag[]> {
  return Object.values(tags);
}
