// Notion DB の canonical_url + distribution プロパティから、frontmatter に出力する
// canonical_url を決定する純関数。

const ZENN_USERNAME = 'lacolaco';
const ZENN_DISTRIBUTION = 'zenn';

/**
 * canonical URL を決定する。優先順位:
 *   1. Notion canonical_url に値があれば採用 (distribution によらず)
 *   2. distribution に "zenn" が含まれる場合は Zenn URL を生成 (slug 同一前提)
 *   3. それ以外は null
 *
 * Notion 側が空白のみ・空文字列のときは「値なし」として扱い、フォールバックロジックに進む。
 */
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
