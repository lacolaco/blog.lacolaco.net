import { isAutoTranslated, type Frontmatter } from '../auto-translate/frontmatter.ts';

/**
 * content/notion/ 配下のファイルの出自。修正先が出自ごとに違う (CLAUDE.md 2b)。
 * - auto-translated: auto-translate が ja から生成した .en.md
 * - notion-sync:     notion-sync が Notion ページから生成した .md / .en.md
 * - direct:          リポジトリで直接管理されているファイル
 */
export type Provenance = 'auto-translated' | 'notion-sync' | 'direct';

export interface ProvenanceInput {
  frontmatter: Frontmatter;
  /** manifest.json の filePath に含まれる = notion-sync が書いた成果物 */
  inManifest: boolean;
}

export function classifyProvenance({ frontmatter, inManifest }: ProvenanceInput): Provenance {
  if (isAutoTranslated(frontmatter)) return 'auto-translated';
  return inManifest ? 'notion-sync' : 'direct';
}

/** notion_url は auto-translate が ja から複製するため、出自の判定には使えない */
export function notionUrlOf(frontmatter: Frontmatter): string | undefined {
  const url = frontmatter.notion_url;
  return typeof url === 'string' && url.length > 0 ? url : undefined;
}

/** auto-translate の出力パス規約 (discover.ts jaToEnPath) の逆変換 */
export function jaSourceOf(enPath: string): string {
  return enPath.replace(/\.en\.md$/, '.md');
}
