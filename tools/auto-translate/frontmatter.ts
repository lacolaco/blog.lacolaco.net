export type Frontmatter = Record<string, unknown>;

export interface BuildEnFrontmatterArgs {
  jaFrontmatter: Frontmatter;
  translatedTitle: string;
  bodyHash: string;
}

export function buildEnFrontmatter(args: BuildEnFrontmatterArgs): Frontmatter {
  const { jaFrontmatter, translatedTitle, bodyHash } = args;
  const en: Frontmatter = { ...jaFrontmatter };
  delete en.auto_translate;
  en.title = translatedTitle;
  en.locale = 'en';
  en.auto_translated_from = bodyHash;
  return en;
}

export function isAutoTranslated(frontmatter: Frontmatter): boolean {
  const v = frontmatter.auto_translated_from;
  return typeof v === 'string' && v.length > 0;
}

export function getAutoTranslatedFrom(frontmatter: Frontmatter): string | undefined {
  const v = frontmatter.auto_translated_from;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
