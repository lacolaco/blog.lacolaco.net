type CanonicalInput = {
  slug: string;
  locale: string | undefined;
  canonicalUrl: string | undefined;
  /** サイトの origin (astro.config の site) */
  site: string | URL;
};

/**
 * 記事ページの link rel=canonical の href を返す。出さないときは undefined。
 *
 * 英語の記事の canonical_url は日本語の記事の複製であり、外部の日本語の記事を指す。
 * 翻訳ページの canonical を元の言語のページに向けると、翻訳ページが検索結果に出にくくなるため、
 * 英語は canonical_url を使わずそのページ自身の URL にする。
 * 日本語は canonical_url があればその値を使う。
 */
export function resolveCanonicalUrl({ slug, locale, canonicalUrl, site }: CanonicalInput): string | undefined {
  if (locale === 'en') {
    // 英語の記事の URL の形は src/pages/posts/[slug].en.astro と getRelativePostUrl に合わせる
    return new URL(`/posts/${slug}.en/`, site).href;
  }
  return canonicalUrl || undefined;
}
