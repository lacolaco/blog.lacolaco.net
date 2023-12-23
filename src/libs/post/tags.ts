import tagsJson from '../../content/tags/tags.json';
import { TagType, Tags } from './schema';

export const tags = Tags.parse(tagsJson);

export function getTagByName(name: string): TagType | undefined {
  return tags[name];
}
