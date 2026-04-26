import { isAutoTranslated, type Frontmatter } from './frontmatter.ts';

export type Action =
  | { kind: 'translate'; jaPath: string; enPath: string }
  | { kind: 'evaluate-cache'; jaPath: string; enPath: string }
  | { kind: 'protect-manual'; jaPath: string; enPath: string }
  | { kind: 'delete-orphan'; jaPath: string; enPath: string }
  | { kind: 'skip'; reason: string };

export interface ClassifyArgs {
  jaPath: string;
  enPath: string;
  ja: Frontmatter;
  en: Frontmatter | null;
}

export function jaToEnPath(jaPath: string): string {
  return jaPath.replace(/\.md$/, '.en.md');
}

export function classifyFile(args: ClassifyArgs): Action {
  const { jaPath, enPath, ja, en } = args;

  // en ファイルは翻訳ソースになり得ない
  if (ja.locale !== 'ja') {
    return { kind: 'skip', reason: 'not-ja-locale' };
  }

  const autoTranslate = ja.auto_translate === true;

  if (autoTranslate) {
    if (en === null) return { kind: 'translate', jaPath, enPath };
    if (isAutoTranslated(en)) return { kind: 'evaluate-cache', jaPath, enPath };
    return { kind: 'protect-manual', jaPath, enPath };
  }

  // auto_translate=false: 既存の auto en は孤立扱いで削除、それ以外は何もしない
  if (en !== null && isAutoTranslated(en)) {
    return { kind: 'delete-orphan', jaPath, enPath };
  }
  return { kind: 'skip', reason: 'auto-translate-disabled' };
}
