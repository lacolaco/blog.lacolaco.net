// Notion DB の auto_translate プロパティと、出力 frontmatter の auto_translate フィールドを
// 扱う純関数。syncNotionDatasource の callback 内に直接書くとユニットテスト困難なため切り出す。

/**
 * Notion から取得した auto_translate プロパティ値（checkbox は boolean、未存在は undefined）を、
 * BlogPostMetadata に格納する boolean 値に正規化する。
 */
export function extractAutoTranslate(raw: boolean | undefined): boolean {
  return raw ?? false;
}

/**
 * frontmatter に出力する auto_translate フィールドの値を決定する。
 * - ja 記事かつ auto_translate=true のみ true を出力
 * - その他は undefined（YAML 出力上はキーごと省略）
 *
 * en 記事は翻訳ソースになり得ないため、Notion 側で誤って auto_translate=true が立っていても
 * frontmatter には出力しない（auto-translate ツールに混乱を持ち込まない）。
 */
export function frontmatterAutoTranslate(locale: string, autoTranslate: boolean): true | undefined {
  return locale === 'ja' && autoTranslate ? true : undefined;
}
