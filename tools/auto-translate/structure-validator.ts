import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import type { Paragraph } from 'mdast';
import { visit } from 'unist-util-visit';

export interface StructureCounts {
  codeBlocks: number;
  images: number;
  links: number;
  bareUrlParagraphs: number;
}

export type StructureMismatchKind = keyof StructureCounts | 'codeBlockContent' | 'inlineCodeContent';

export interface StructureMismatch {
  kind: StructureMismatchKind;
  source: number;
  target: number;
  detail?: string;
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

interface StructureSnapshot {
  counts: StructureCounts;
  codeContents: string[];
  inlineCodeContents: string[];
}

function snapshotStructure(markdown: string): StructureSnapshot {
  const tree = remark().use(remarkGfm).parse(markdown);
  let codeBlocks = 0;
  let images = 0;
  let links = 0;
  let bareUrlParagraphs = 0;
  const codeContents: string[] = [];
  const inlineCodeContents: string[] = [];

  visit(tree, (node, _index, parent) => {
    if (node.type === 'code') {
      codeBlocks++;
      codeContents.push(node.value);
    } else if (node.type === 'inlineCode') {
      inlineCodeContents.push(node.value);
    } else if (node.type === 'image') images++;
    else if (node.type === 'link') links++;
    // remark-embed と一致させるため、ルート直下の paragraph のみを bare URL paragraph として数える
    else if (node.type === 'paragraph' && parent?.type === 'root' && isBareUrlParagraph(node)) {
      bareUrlParagraphs++;
    }
  });

  return {
    counts: { codeBlocks, images, links, bareUrlParagraphs },
    codeContents,
    inlineCodeContents,
  };
}

export function countStructure(markdown: string): StructureCounts {
  return snapshotStructure(markdown).counts;
}

// マルチセット差分: 順序を問わず、source の各要素が target に同数存在するか検証
function diffMultiset(source: string[], target: string[]): { ok: boolean; missingFromTarget: string[] } {
  const remaining = new Map<string, number>();
  for (const v of target) remaining.set(v, (remaining.get(v) ?? 0) + 1);
  const missing: string[] = [];
  for (const v of source) {
    const c = remaining.get(v) ?? 0;
    if (c === 0) {
      missing.push(v);
    } else {
      remaining.set(v, c - 1);
    }
  }
  return { ok: missing.length === 0, missingFromTarget: missing };
}

export function validateStructure(source: string, target: string): ValidationResult {
  const src = snapshotStructure(source);
  const tgt = snapshotStructure(target);
  const mismatches: StructureMismatch[] = [];

  const kinds: (keyof StructureCounts)[] = ['codeBlocks', 'images', 'links', 'bareUrlParagraphs'];
  for (const kind of kinds) {
    if (src.counts[kind] !== tgt.counts[kind]) {
      mismatches.push({ kind, source: src.counts[kind], target: tgt.counts[kind] });
    }
  }

  // コードブロックの中身は byte 単位で source と一致しなければならない（コメント翻訳・引用符変換等を検出）
  if (src.counts.codeBlocks === tgt.counts.codeBlocks) {
    const diff = diffMultiset(src.codeContents, tgt.codeContents);
    if (!diff.ok) {
      mismatches.push({
        kind: 'codeBlockContent',
        source: src.codeContents.length,
        target: tgt.codeContents.length,
        detail: `code block content modified: ${JSON.stringify(diff.missingFromTarget[0]?.slice(0, 80))}`,
      });
    }
  }

  // インラインコードも同様
  const inlineDiff = diffMultiset(src.inlineCodeContents, tgt.inlineCodeContents);
  if (!inlineDiff.ok) {
    mismatches.push({
      kind: 'inlineCodeContent',
      source: src.inlineCodeContents.length,
      target: tgt.inlineCodeContents.length,
      detail: `inline code modified: ${JSON.stringify(inlineDiff.missingFromTarget[0]?.slice(0, 80))}`,
    });
  }

  return { ok: mismatches.length === 0, source: src.counts, target: tgt.counts, mismatches };
}
