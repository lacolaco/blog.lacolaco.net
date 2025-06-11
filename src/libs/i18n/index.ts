import { getCollection } from 'astro:content';
import { getRelativeLocaleUrl } from 'astro:i18n';
import { Locale, type PostData } from '../post/schema';

export function toRelativeUrl(slug: string, locale: Locale) {
  return getRelativeLocaleUrl(locale, slug, { prependWith: 'posts' });
}

export async function findLocalizedVersion(base: PostData, locale: Locale) {
  return await getCollection('post').then((posts) => {
    return posts.find((post) => post.data.slug === base.slug && post.data.locale === locale);
  });
}
