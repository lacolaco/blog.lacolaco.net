import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import type { Paragraph } from 'mdast';
import type { Parent } from 'unist';
import { visitParents } from 'unist-util-visit-parents';
import { hasBlockquoteAncestor } from './ast-utils.ts';

export interface StructureCounts {
  codeBlocks: number;
  inlineCodes: number;
  images: number;
  links: number;
  bareUrlParagraphs: number;
}

export type StructureMismatchKind = keyof StructureCounts | 'blockquoteCodeContent';

export interface StructureMismatch {
  kind: StructureMismatchKind;
  source: number;
  target: number;
  /**
   * blockquoteCodeContent でのみ使用:
   * - 'count': source/target の個数自体が異なる
   * - 'content': 個数は同じだが内容が異なる
   */
  differKind?: 'count' | 'content';
}

export interface ValidationResult {
  ok: boolean;
  source: StructureCounts;
  target: StructureCounts;
  mismatches: StructureMismatch[];
}

// remark-embed と同じ判定: paragraph の唯一の子が link で、リンクテキスト === URL
function isBareUrlParagraph(node: Paragraph): boolean {
  if (node.children.length !== 1) return false;
  const link = node.children[0];
  if (link.type !== 'link') return false;
  const linkText = link.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
  return linkText === link.url;
}

// remark プロセッサはプラグイン初期化のコストがあるためモジュールレベルで一度だけ生成
const remarkProcessor = remark().use(remarkGfm);

interface StructureSnapshotInternal {
  counts: StructureCounts;
  // blockquote 内コードは code-extractor で抽出されないため LLM プロンプトに直接渡る。
  // byte-identical 保持を検証するため、内容を保持して validateStructure で比較する
  blockquoteCodeContents: string[];
}

function snapshotStructureInternal(markdown: string): StructureSnapshotInternal {
  const tree = remarkProcessor.parse(markdown);
  let codeBlocks = 0;
  let inlineCodes = 0;
  let images = 0;
  let links = 0;
  let bareUrlParagraphs = 0;
  const blockquoteCodeContents: string[] = [];

  visitParents(tree, (node, ancestors: Parent[]) => {
    if (hasBlockquoteAncestor(ancestors)) {
      // blockquote 内の code は別途内容比較対象として保持し、通常カウントには含めない
      // （別経路の byte-identical 検証で扱う）
      if (node.type === 'code') {
        blockquoteCodeContents.push(node.value);
        return;
      }
      // image / link / inlineCode は LLM が直接扱うので、blockquote 内でも通常カウントに含める。
      // fall-through して下のカウントロジックへ
    }

    if (node.type === 'code') {
      codeBlocks++;
    } else if (node.type === 'inlineCode') {
      inlineCodes++;
    } else if (node.type === 'image') images++;
    else if (node.type === 'link') links++;
    // remark-embed と一致させるため、ルート直下の paragraph のみを bare URL paragraph として数える
    else if (
      node.type === 'paragraph' &&
      ancestors[ancestors.length - 1]?.type === 'root' &&
      isBareUrlParagraph(node)
    ) {
      bareUrlParagraphs++;
    }
  });

  return {
    counts: { codeBlocks, inlineCodes, images, links, bareUrlParagraphs },
    blockquoteCodeContents,
  };
}

export function countStructure(markdown: string): StructureCounts {
  return snapshotStructureInternal(markdown).counts;
}

export function validateStructure(source: string, target: string): ValidationResult {
  const src = snapshotStructureInternal(source);
  const tgt = snapshotStructureInternal(target);
  const mismatches: StructureMismatch[] = [];

  const kinds: (keyof StructureCounts)[] = ['codeBlocks', 'inlineCodes', 'images', 'links', 'bareUrlParagraphs'];
  for (const kind of kinds) {
    if (src.counts[kind] !== tgt.counts[kind]) {
      mismatches.push({ kind, source: src.counts[kind], target: tgt.counts[kind] });
    }
  }

  // コードブロック（blockquote 外）・インラインコードの内容比較は実施しない:
  // - コードブロック: code-translator でコメントのみ翻訳されるため byte 内容は意図的に異なる
  // - インラインコード: extractCode → restoreCode で ja のものを byte 一致で復元するため常に一致
  // カウント一致は codeBlocks / inlineCodes で担保済み

  // blockquote 内コードはプレースホルダ化されず LLM プロンプトに直接渡るため、byte 一致を検証する。
  // 順序を含めた完全一致を要求（contents 配列の長さ・各要素の byte 一致）。
  // count 差異と content 差異は別物なので differKind で区別する（フィードバックメッセージで使い分け）
  const srcBq = src.blockquoteCodeContents;
  const tgtBq = tgt.blockquoteCodeContents;
  if (srcBq.length !== tgtBq.length) {
    mismatches.push({
      kind: 'blockquoteCodeContent',
      source: srcBq.length,
      target: tgtBq.length,
      differKind: 'count',
    });
  } else if (srcBq.some((v, i) => v !== tgtBq[i])) {
    mismatches.push({
      kind: 'blockquoteCodeContent',
      source: srcBq.length,
      target: tgtBq.length,
      differKind: 'content',
    });
  }

  return { ok: mismatches.length === 0, source: src.counts, target: tgt.counts, mismatches };
}
