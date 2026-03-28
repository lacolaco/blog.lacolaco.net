import { Channel } from '../post/schema';
import { channels } from '../post/properties';

export function queryChannels(): Channel[] {
  return channels;
}
