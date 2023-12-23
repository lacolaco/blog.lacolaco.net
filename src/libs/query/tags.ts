import { TagType } from '../post/schema';
import { tags } from '../post/tags';

export async function queryTags(): Promise<TagType[]> {
  return Object.values(tags);
}
