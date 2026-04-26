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

export interface StructureMismatch {
  kind: keyof StructureCounts;
  source: number;
  target: number;
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

export function countStructure(markdown: string): StructureCounts {
  const tree = remark().use(remarkGfm).parse(markdown);
  let codeBlocks = 0;
  let images = 0;
  let links = 0;
  let bareUrlParagraphs = 0;

  visit(tree, (node, _index, parent) => {
    if (node.type === 'code') codeBlocks++;
    else if (node.type === 'image') images++;
    else if (node.type === 'link') links++;
    // remark-embed と一致させるため、ルート直下の paragraph のみを bare URL paragraph として数える
    else if (node.type === 'paragraph' && parent?.type === 'root' && isBareUrlParagraph(node)) {
      bareUrlParagraphs++;
    }
  });

  return { codeBlocks, images, links, bareUrlParagraphs };
}

export function validateStructure(source: string, target: string): ValidationResult {
  const sourceCounts = countStructure(source);
  const targetCounts = countStructure(target);
  const mismatches: StructureMismatch[] = [];
  const kinds: (keyof StructureCounts)[] = ['codeBlocks', 'images', 'links', 'bareUrlParagraphs'];
  for (const kind of kinds) {
    if (sourceCounts[kind] !== targetCounts[kind]) {
      mismatches.push({ kind, source: sourceCounts[kind], target: targetCounts[kind] });
    }
  }
  return { ok: mismatches.length === 0, source: sourceCounts, target: targetCounts, mismatches };
}
