import notionTagsJson from '../../content/post/notion/tags.json';
import notionChannelsJson from '../../content/post/notion/channels.json';
import { Tag, Tags, Channel, Channels } from './schema';

export const tags = Tags.parse(notionTagsJson);

export function getTagByName(name: string): Tag | undefined {
  return tags.find((tag) => tag.name === name);
}

export const channels = Channels.parse(notionChannelsJson);

export function getChannelByName(name: string): Channel | undefined {
  return channels.find((channel) => channel.name === name);
}
