import { z, getCollection } from 'astro:content';
import { getRelativeLocaleUrl } from 'astro:i18n';
import { PostData } from './schema';

export const Locale = z.enum(['ja', 'en']);
export type Locale = z.infer<typeof Locale>;

export function getRelativePostUrl(post: PostData) {
  return getRelativeLocaleUrl(post.locale, `${post.slug}`, {
    prependWith: 'posts',
  });
}

export async function findLocalizedVersion(base: PostData, locale: Locale) {
  return await getCollection('post').then((posts) => {
    return posts.find((post) => post.data.slug === base.slug && post.data.locale === locale);
  });
}
