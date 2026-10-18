import { getRelativePostUrl } from '../compat';

type CanonicalInput = {
  slug: string;
  locale: string | undefined;
  canonicalUrl: string | undefined;
  site: string | URL;
};

export function resolveCanonicalUrl({ slug, locale, canonicalUrl, site }: CanonicalInput): string | undefined {
  if (locale === 'en') {
    // 英語の canonical_url は日本語の記事から複製された値なので使わない
    return new URL(`${getRelativePostUrl({ data: { slug, locale } })}/`, site).href;
  }
  return canonicalUrl || undefined;
}
