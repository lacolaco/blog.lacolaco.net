const ZENN_USERNAME = 'lacolaco';
const ZENN_DISTRIBUTION = 'zenn';

// 優先順位: Notion canonical_url > zenn distribution 自動生成 > null
export function resolveCanonicalUrl(
  notionCanonical: string | undefined,
  distribution: string[] | undefined,
  slug: string,
): string | null {
  const explicit = notionCanonical?.trim();
  if (explicit) {
    return explicit;
  }
  if (distribution?.includes(ZENN_DISTRIBUTION)) {
    return `https://zenn.dev/${ZENN_USERNAME}/articles/${slug}`;
  }
  return null;
}
