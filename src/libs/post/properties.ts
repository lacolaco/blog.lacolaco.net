import notionTagsJson from '../../content/post/notion/tags.json';
import notionCategoriesJson from '../../content/post/notion/categories.json';
import notionChannelsJson from '../../content/post/notion/channels.json';
import { Tag, Tags, Category, Categories, Channel, Channels } from './schema';

export const tags = Tags.parse(notionTagsJson as Tag[]);

export function getTagByName(name: string): Tag | undefined {
  return tags.find((tag) => tag.name === name);
}

export const categories = Categories.parse(notionCategoriesJson as Category[]);

export const channels = Channels.parse(notionChannelsJson as Channel[]);

export function getChannelByName(name: string): Channel | undefined {
  return channels.find((channel) => channel.name === name);
}
