import type { CollectionEntry } from 'astro:content';
import { channels as channelDefinitions } from './post/properties';

export function getDate(post: CollectionEntry<'posts'>): Date {
  return post.data.created_time;
}

export function getRelativePostUrl(post: CollectionEntry<'posts'>): string {
  const localeSuffix = post.data.locale === 'en' ? '.en' : '';
  return `/posts/${post.data.slug}${localeSuffix}`;
}

export function getTitle(post: CollectionEntry<'posts'>): string {
  return post.data.title;
}

/** @deprecated channels への移行後に削除 */
export function getCategory(post: CollectionEntry<'posts'>): string | undefined {
  return post.data.category;
}

export function getChannels(post: CollectionEntry<'posts'>): string[] {
  const postChannels = post.data.channels ?? [];
  const order = channelDefinitions.map((c) => c.name);
  return [...postChannels].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    return (indexA === -1 ? order.length : indexA) - (indexB === -1 ? order.length : indexB);
  });
}

export function getTags(post: CollectionEntry<'posts'>): string[] {
  return post.data.tags;
}
