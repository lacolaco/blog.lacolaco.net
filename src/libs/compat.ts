import type { CollectionEntry } from 'astro:content';

export function getDate(post: CollectionEntry<'postsV2'>): Date {
  return post.data.created_time;
}

export function getRelativePostUrl(post: CollectionEntry<'postsV2'>): string {
  const localeSuffix = post.data.locale === 'en' ? '.en' : '';
  return `/posts/${post.data.slug}${localeSuffix}`;
}

export function getTitle(post: CollectionEntry<'postsV2'>): string {
  return post.data.title;
}

export function getCategory(post: CollectionEntry<'postsV2'>): string | undefined {
  return post.data.category;
}

export function getTags(post: CollectionEntry<'postsV2'>): string[] {
  return post.data.tags;
}
