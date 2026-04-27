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

export function restoreCode(template: string, codeBlocks: string[], inlineCodes: string[]): string {
  // テンプレート内のプレースホルダを順序通りに置換。
  // String#replace のコールバック形式を使い、$ を含む code が special replacement として誤解釈されないようにする
  const result = template.replace(PLACEHOLDER_PATTERN, (_match, kind: string, idxStr: string) => {
    const idx = Number(idxStr);
    if (kind === 'BLOCK') {
      if (idx >= codeBlocks.length) {
        throw new Error(`Restore failed: placeholder ⟨⟨BLOCK_${idx}⟩⟩ has no corresponding code block`);
      }
      return codeBlocks[idx];
    }
    // INLINE
    if (idx >= inlineCodes.length) {
      throw new Error(`Restore failed: placeholder ⟨⟨INLINE_${idx}⟩⟩ has no corresponding inline code`);
    }
    return inlineCodes[idx];
  });

  // restored 後にまだプレースホルダが残っていたら何かおかしい（unexpected pattern）
  if (PLACEHOLDER_PATTERN.test(result)) {
    PLACEHOLDER_PATTERN.lastIndex = 0;
    throw new Error(`Restore failed: placeholder pattern remains after restoration`);
  }
  PLACEHOLDER_PATTERN.lastIndex = 0;

  // テンプレートに含まれていなかったプレースホルダ index があれば、LLM が drop した可能性
  // （上の置換でカウント済みなので余り index がないか検証）
  for (let i = 0; i < codeBlocks.length; i++) {
    if (template.indexOf(BLOCK_PLACEHOLDER(i)) === -1) {
      throw new Error(`Restore failed: placeholder ⟨⟨BLOCK_${i}⟩⟩ missing from template (LLM dropped it?)`);
    }
  }
  for (let i = 0; i < inlineCodes.length; i++) {
    if (template.indexOf(INLINE_PLACEHOLDER(i)) === -1) {
      throw new Error(`Restore failed: placeholder ⟨⟨INLINE_${i}⟩⟩ missing from template (LLM dropped it?)`);
    }
  }

  return result;
}
