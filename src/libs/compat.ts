import type { CollectionEntry } from 'astro:content';
import { channels as channelDefinitions } from './post/properties';

export function getDate(post: CollectionEntry<'posts' | 'postsEn'>): Date {
  return post.data.created_time;
}

export function getRelativePostUrl(post: CollectionEntry<'posts' | 'postsEn'>): string {
  const localeSuffix = post.data.locale === 'en' ? '.en' : '';
  return `/posts/${post.data.slug}${localeSuffix}`;
}

export function getTitle(post: CollectionEntry<'posts' | 'postsEn'>): string {
  return post.data.title;
}

export function getChannels(post: CollectionEntry<'posts' | 'postsEn'>): string[] {
  const postChannels = post.data.channels ?? [];
  const order = channelDefinitions.map((c) => c.name);
  return [...postChannels].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    return (indexA === -1 ? order.length : indexA) - (indexB === -1 ? order.length : indexB);
  });
}
