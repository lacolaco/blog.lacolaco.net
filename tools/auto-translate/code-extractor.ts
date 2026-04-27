// LLM に code を見せず prose だけ翻訳させるための extractor / restorer。
// LLM に code byte-fidelity を要求するのは無理筋なので、コードを抽出してプレースホルダ ⟨⟨BLOCK_N⟩⟩ /
// ⟨⟨INLINE_N⟩⟩ に置換し、翻訳後にプログラムで復元する。これにより code は LLM を経由しない。

import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import type { Node, Parent } from 'unist';
import { visitParents } from 'unist-util-visit-parents';

const remarkProcessor = remark().use(remarkGfm);

const BLOCK_PLACEHOLDER = (i: number) => `⟨⟨BLOCK_${i}⟩⟩`;
const INLINE_PLACEHOLDER = (i: number) => `⟨⟨INLINE_${i}⟩⟩`;
const PLACEHOLDER_PATTERN = /⟨⟨(BLOCK|INLINE)_(\d+)⟩⟩/g;

// prose 中に文字列として ⟨⟨ や ⟩⟩ が現れる場合（このシステム自体を解説する記事等）に、
// extractCode が生成するプレースホルダと衝突しないよう一旦別文字に escape する。
// 復元はちょうど逆順に: restoreCode 内で escape を解いて元の文字列に戻す。
// U+27EA / U+27EB（mathematical double angle brackets）を使う: ⟨ U+27E8 と類似だが別 codepoint
const ESCAPED_OPEN = '⟪⟪'; // ⟪⟪
const ESCAPED_CLOSE = '⟫⟫'; // ⟫⟫

function escapeBareMarkers(s: string): string {
  // escape 文字も markdown に既に存在すると unescape で誤戻しするため、衝突時は throw する。
  // ⟪⟪ や ⟫⟫ は極稀なので実害はほぼないが、明示的に失敗させて silent corruption を防ぐ
  if (s.includes(ESCAPED_OPEN) || s.includes(ESCAPED_CLOSE)) {
    throw new Error(
      `Source contains reserved escape sequence (${ESCAPED_OPEN} or ${ESCAPED_CLOSE}); cannot extract code safely`,
    );
  }
  return s.split('⟨⟨').join(ESCAPED_OPEN).split('⟩⟩').join(ESCAPED_CLOSE);
}

function unescapeBareMarkers(s: string): string {
  return s.split(ESCAPED_OPEN).join('⟨⟨').split(ESCAPED_CLOSE).join('⟩⟩');
}

export interface ExtractedCode {
  /** プレースホルダで code を置換した markdown。LLM にはこれを渡す */
  template: string;
  /** コードブロックの元テキスト（fence 含む完全な形）を順序通りに保持 */
  codeBlocks: string[];
  /** インラインコードの元テキスト（バッククォート含む）を順序通りに保持 */
  inlineCodes: string[];
}

// blockquote 内の code/inlineCode は markdown.slice() が `> ` プレフィックス混在の文字列を返すため、
// プレースホルダ化すると translateCodeBlock 側の fence 検証が壊れる（silent failure を起こす）。
// 抽出対象外として template に残し、LLM の prose 翻訳に委ねる
function hasBlockquoteAncestor(ancestors: readonly Parent[]): boolean {
  return ancestors.some((a) => a.type === 'blockquote');
}

export function extractCode(markdown: string): ExtractedCode {
  // markdown 全体の ⟨⟨ ⟩⟩ を別文字に escape してからパース。
  // これによりプレースホルダ ⟨⟨BLOCK_N⟩⟩ と prose 中の同名文字列の衝突を回避する。
  // 文字置換は同じ文字数（BMP 内 1 unit → 1 unit）なので mdast の position offset は変わらない
  const escapedMarkdown = escapeBareMarkers(markdown);
  const tree = remarkProcessor.parse(escapedMarkdown);
  const replacements: { start: number; end: number; replacement: string }[] = [];
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  visitParents(tree, (node: Node, ancestors: Parent[]) => {
    const pos = node.position;
    if (pos == null) return;
    const start = pos.start.offset;
    const end = pos.end.offset;
    if (start == null || end == null) return;
    if (hasBlockquoteAncestor(ancestors)) return;

    if (node.type === 'code') {
      const idx = codeBlocks.length;
      // codeBlocks には escape された状態で保持。restoreCode の最後で全体を unescape する
      codeBlocks.push(escapedMarkdown.slice(start, end));
      replacements.push({ start, end, replacement: BLOCK_PLACEHOLDER(idx) });
    } else if (node.type === 'inlineCode') {
      const idx = inlineCodes.length;
      inlineCodes.push(escapedMarkdown.slice(start, end));
      replacements.push({ start, end, replacement: INLINE_PLACEHOLDER(idx) });
    }
  });

  // 右から左へ置換することでオフセットがズレないようにする
  replacements.sort((a, b) => b.start - a.start);
  let template = escapedMarkdown;
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
  const restored = template.replace(PLACEHOLDER_PATTERN, (_match, kind: string, idxStr: string) => {
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

  // extractCode で escape した ⟪⟪ ⟫⟫ を元の ⟨⟨ ⟩⟩ に戻す（prose 中・code 内容両方に適用）
  return unescapeBareMarkers(restored);
}
