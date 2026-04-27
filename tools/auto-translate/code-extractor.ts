// LLM に code を見せず prose だけ翻訳させるための extractor / restorer。
// LLM に code byte-fidelity を要求するのは無理筋なので、コードを抽出してプレースホルダ ⟨⟨BLOCK_N⟩⟩ /
// ⟨⟨INLINE_N⟩⟩ に置換し、翻訳後にプログラムで復元する。これにより code は LLM を経由しない。

import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

const remarkProcessor = remark().use(remarkGfm);

const BLOCK_PLACEHOLDER = (i: number) => `⟨⟨BLOCK_${i}⟩⟩`;
const INLINE_PLACEHOLDER = (i: number) => `⟨⟨INLINE_${i}⟩⟩`;
const PLACEHOLDER_PATTERN = /⟨⟨(BLOCK|INLINE)_(\d+)⟩⟩/g;

export interface ExtractedCode {
  /** プレースホルダで code を置換した markdown。LLM にはこれを渡す */
  template: string;
  /** コードブロックの元テキスト（fence 含む完全な形）を順序通りに保持 */
  codeBlocks: string[];
  /** インラインコードの元テキスト（バッククォート含む）を順序通りに保持 */
  inlineCodes: string[];
}

export function extractCode(markdown: string): ExtractedCode {
  const tree = remarkProcessor.parse(markdown);
  const replacements: { start: number; end: number; replacement: string }[] = [];
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  visit(tree, (node) => {
    const pos = node.position;
    if (pos == null) return;
    const start = pos.start.offset;
    const end = pos.end.offset;
    if (start == null || end == null) return;

    if (node.type === 'code') {
      const idx = codeBlocks.length;
      codeBlocks.push(markdown.slice(start, end));
      replacements.push({ start, end, replacement: BLOCK_PLACEHOLDER(idx) });
    } else if (node.type === 'inlineCode') {
      const idx = inlineCodes.length;
      inlineCodes.push(markdown.slice(start, end));
      replacements.push({ start, end, replacement: INLINE_PLACEHOLDER(idx) });
    }
  });

  // 右から左へ置換することでオフセットがズレないようにする
  replacements.sort((a, b) => b.start - a.start);
  let template = markdown;
  for (const r of replacements) {
    template = template.slice(0, r.start) + r.replacement + template.slice(r.end);
  }
  return { template, codeBlocks, inlineCodes };
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  return haystack.split(needle).length - 1;
}

export function restoreCode(template: string, codeBlocks: string[], inlineCodes: string[]): string {
  // テンプレート側で各プレースホルダが exactly 1 回現れることを検証する。
  // - 0 回 = LLM が drop した
  // - 2 回以上 = LLM が重複させた（同じ code が複数箇所に挿入されてしまう）
  // 復元後の result でプレースホルダパターンを検査するのは誤り: codeBlocks[i] の内容自体が
  // ⟨⟨BLOCK_N⟩⟩ のような文字列を含む可能性がある（このシステムを解説する記事等）
  for (let i = 0; i < codeBlocks.length; i++) {
    const ph = BLOCK_PLACEHOLDER(i);
    const n = countOccurrences(template, ph);
    if (n === 0) {
      throw new Error(`Restore failed: placeholder ${ph} missing from template (LLM dropped it?)`);
    }
    if (n > 1) {
      throw new Error(`Restore failed: placeholder ${ph} appears ${n} times in template (LLM duplicated it?)`);
    }
  }
  for (let i = 0; i < inlineCodes.length; i++) {
    const ph = INLINE_PLACEHOLDER(i);
    const n = countOccurrences(template, ph);
    if (n === 0) {
      throw new Error(`Restore failed: placeholder ${ph} missing from template (LLM dropped it?)`);
    }
    if (n > 1) {
      throw new Error(`Restore failed: placeholder ${ph} appears ${n} times in template (LLM duplicated it?)`);
    }
  }

  // テンプレート内のプレースホルダを順序通りに置換。
  // String#replace のコールバック形式を使い、$ を含む code が special replacement として誤解釈されないようにする
  return template.replace(PLACEHOLDER_PATTERN, (_match, kind: string, idxStr: string) => {
    const idx = Number(idxStr);
    if (kind === 'BLOCK') {
      if (idx >= codeBlocks.length) {
        throw new Error(`Restore failed: placeholder ⟨⟨BLOCK_${idx}⟩⟩ has no corresponding code block (hallucinated?)`);
      }
      return codeBlocks[idx];
    }
    // INLINE
    if (idx >= inlineCodes.length) {
      throw new Error(`Restore failed: placeholder ⟨⟨INLINE_${idx}⟩⟩ has no corresponding inline code (hallucinated?)`);
    }
    return inlineCodes[idx];
  });
}
