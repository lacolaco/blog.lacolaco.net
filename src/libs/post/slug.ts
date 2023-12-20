import { Locale } from './schema';

export function getPostJSONFileName(slug: string, locale: Locale): string {
  return (locale ?? 'ja') === 'ja' ? `${slug}.json` : `${slug}.${locale}.json`;
}
