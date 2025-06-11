import { toRelativeUrl } from '@lib/i18n';
import type { CollectionEntry } from 'astro:content';

export type PostDataCompat = CollectionEntry<'post'> | CollectionEntry<'postsV2'>;

export function getDate(post: PostDataCompat): Date {
  return post.collection === 'postsV2' ? post.data.created_time : post.data.properties.date;
}

export function getRelativePostUrl(post: PostDataCompat): string {
  return post.collection === 'postsV2' ? `/posts/${post.data.slug}` : toRelativeUrl(post.data.slug, post.data.locale);
}

export function getTitle(post: PostDataCompat): string {
  return post.collection === 'postsV2' ? post.data.title : post.data.properties.title;
}

export function getCategory(post: PostDataCompat): string | undefined {
  return post.collection === 'postsV2' ? post.data.category : post.data.properties.category;
}

export function getTags(post: PostDataCompat): string[] {
  return post.collection === 'postsV2' ? post.data.tags : post.data.properties.tags;
}
