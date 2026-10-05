export type Locale = 'ja' | 'en';

/** ページの lang 属性から検索の locale を選ぶ。en 以外は ja */
export function localeOf(lang: string | undefined): Locale {
  return lang === 'en' || lang?.startsWith('en-') ? 'en' : 'ja';
}

/** 検索 API の要求 URL。空や空白だけの語は要求しない (null) */
export function buildSearchUrl(endpoint: string, q: string, locale: Locale): string | null {
  const term = q.trim();
  if (!term) return null;
  return `${endpoint}?q=${encodeURIComponent(term)}&locale=${locale}`;
}
