import type { CollectionEntry } from 'astro:content';

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

export function getCategory(post: CollectionEntry<'posts'>): string | undefined {
  return post.data.category;
}

export function getTags(post: CollectionEntry<'posts'>): string[] {
  return post.data.tags;
}
