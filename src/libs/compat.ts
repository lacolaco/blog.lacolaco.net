import type { CollectionEntry } from 'astro:content';

export type PostDataCompat = CollectionEntry<'postsV2'>;

export function getDate(post: PostDataCompat): Date {
  return post.data.created_time;
}

export function getRelativePostUrl(post: PostDataCompat): string {
  return `/posts/${post.data.slug}`;
}

export function getTitle(post: PostDataCompat): string {
  return post.data.title;
}

export function getCategory(post: PostDataCompat): string | undefined {
  return post.data.category;
}

export function getTags(post: PostDataCompat): string[] {
  return post.data.tags;
}
