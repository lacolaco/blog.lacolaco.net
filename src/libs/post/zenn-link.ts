const ZENN_HOSTNAME = 'zenn.dev';

// 英語版は自動翻訳で canonical_url が複製されるため locale で除外し、ホストは部分一致だと zenn.dev.example.com が通るので完全一致で判定する
export function getZennLinkUrl({ locale, canonical_url }: { locale?: string; canonical_url?: string }): string | null {
  if ((locale || 'ja') !== 'ja' || !canonical_url) return null;
  if (!URL.canParse(canonical_url)) return null;
  const url = new URL(canonical_url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return url.hostname === ZENN_HOSTNAME ? canonical_url : null;
}
