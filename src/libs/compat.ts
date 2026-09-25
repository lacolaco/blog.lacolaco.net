import type { CollectionEntry } from 'astro:content';
import { channels as channelDefinitions } from './post/properties';

export function getDate(post: CollectionEntry<'posts' | 'postsEn'>): Date {
  return post.data.created_time;
}

export function getRelativePostUrl(post: CollectionEntry<'posts' | 'postsEn'>): string {
  const localeSuffix = post.data.locale === 'en' ? '.en' : '';
  return `/posts/${post.data.slug}${localeSuffix}`;
}

/**
 * 記事の OG 画像パス。ja と en は同じ slug を共有するため、en では locale を明示しないと
 * OG ルートが ja 記事を描画してしまう。ja は既存の CDN キャッシュ URL を変えないようパラメータを付けない。
 * t (last_edited_time) は Cloudflare CDN のキャッシュ無効化用。
 */
export function getOgImagePath(post: CollectionEntry<'posts' | 'postsEn'>): string {
  const localeParam = post.data.locale === 'en' ? '&locale=en' : '';
  return `/og/${post.data.slug}.png?t=${post.data.last_edited_time.getTime()}${localeParam}`;
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
