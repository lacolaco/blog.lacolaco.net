import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import type { Paragraph } from 'mdast';
import type { Parent } from 'unist';
import { visitParents } from 'unist-util-visit-parents';

export interface StructureCounts {
  codeBlocks: number;
  inlineCodes: number;
  images: number;
  links: number;
  bareUrlParagraphs: number;
}

export type StructureMismatchKind = keyof StructureCounts;

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
}

// remark プロセッサはプラグイン初期化のコストがあるためモジュールレベルで一度だけ生成
const remarkProcessor = remark().use(remarkGfm);

function isInBlockquote(ancestors: readonly Parent[]): boolean {
  return ancestors.some((a) => a.type === 'blockquote');
}

function snapshotStructure(markdown: string): StructureSnapshot {
  const tree = remarkProcessor.parse(markdown);
  let codeBlocks = 0;
  let inlineCodes = 0;
  let images = 0;
  let links = 0;
  let bareUrlParagraphs = 0;

  visitParents(tree, (node, ancestors: Parent[]) => {
    // blockquote 内の要素は code-extractor 側でも抽出対象外。
    // ja/en 両方で同じ条件で数える限り、validateStructure の対称性は崩れない
    if (isInBlockquote(ancestors)) return;

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
  };
}

export function countStructure(markdown: string): StructureCounts {
  return snapshotStructure(markdown).counts;
}

export function validateStructure(source: string, target: string): ValidationResult {
  const src = snapshotStructure(source);
  const tgt = snapshotStructure(target);
  const mismatches: StructureMismatch[] = [];

  const kinds: (keyof StructureCounts)[] = ['codeBlocks', 'inlineCodes', 'images', 'links', 'bareUrlParagraphs'];
  for (const kind of kinds) {
    if (src.counts[kind] !== tgt.counts[kind]) {
      mismatches.push({ kind, source: src.counts[kind], target: tgt.counts[kind] });
    }
  }

  // コードブロック・インラインコードの内容比較は実施しない:
  // 新アーキテクチャでは LLM に code を渡さず、translator 側で extractCode → restoreCode する。
  // - コードブロック: 別経路でコメントのみ翻訳されるため byte 内容は意図的に異なる
  // - インラインコード: ja のものを byte 一致で復元するため、validateStructure では常に一致する
  //   （ここで内容比較しても dead code。restoreCode のテストで動作保証）
  // カウント一致は codeBlocks / inlineCodes で担保済み

  return { ok: mismatches.length === 0, source: src.counts, target: tgt.counts, mismatches };
}
