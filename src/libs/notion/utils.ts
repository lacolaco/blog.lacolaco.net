import { createHash } from 'node:crypto';
import type { BlogPostLocale, PageObject, PageProperty } from './types';

/**
 * If the page has slug property, return it.
 * Otherwise, return generated slug made from page's id.
 */
export function getSlug(page: PageObject): string {
  const { slug } = page.properties as { slug?: PageProperty<'rich_text'> };
  if (slug && slug.rich_text.length > 0 && slug.rich_text[0].plain_text.length > 0) {
    return slug.rich_text[0].plain_text;
  }
  // generate 12-length-hex slug from page id
  return createHash('sha1').update(page.id).digest('hex').slice(0, 12);
}

export function getLocale(page: PageObject): BlogPostLocale | undefined {
  const { locale } = page.properties as { locale?: PageProperty<'select'> };
  if (locale && locale.select) {
    return locale.select.name as BlogPostLocale;
  }
  return undefined;
}
