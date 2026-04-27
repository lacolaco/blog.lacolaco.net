import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import type { Paragraph } from 'mdast';
import type { Parent } from 'unist';
import { visitParents } from 'unist-util-visit-parents';
import { hasBlockquoteAncestor } from './ast-utils.ts';

export interface StructureCounts {
  /**
   * blockquote 外のコードブロック数のみ。
   * blockquote 内コードブロックは別途 blockquoteCodeContents で内容比較される
   */
  codeBlocks: number;
  /** インラインコード総数（blockquote 内外両方を含む） */
  inlineCodes: number;
  images: number;
  links: number;
  bareUrlParagraphs: number;
}

export type StructureMismatchKind = keyof StructureCounts | 'blockquoteCodeContent' | 'blockquoteInlineCodeContent';

export interface StructureMismatch {
  kind: StructureMismatchKind;
  /** ソース文書のカウント */
  source: number;
  /** ターゲット文書のカウント */
  target: number;
  /**
   * `blockquoteCodeContent` でのみ使用。差異の種類を識別する:
   * - 'count': source/target の個数自体が異なる
   * - 'content': 個数は同じだが内容が異なる。`differingCount` に差異のあるブロック数が入る
   */
  differKind?: 'count' | 'content';
  /** content 差異時のみ設定。source 全体のうち何ブロックで差異が出たか */
  differingCount?: number;
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
  // blockquote 内のコード関連は code-extractor で抽出されないため LLM プロンプトに直接渡る。
  // byte-identical 保持を検証するため、内容を保持して validateStructure で比較する
  blockquoteCodeContents: string[];
  blockquoteInlineCodeContents: string[];
}

function snapshotStructureInternal(markdown: string): StructureSnapshotInternal {
  const tree = remarkProcessor.parse(markdown);
  let codeBlocks = 0;
  let inlineCodes = 0;
  let images = 0;
  let links = 0;
  let bareUrlParagraphs = 0;
  const blockquoteCodeContents: string[] = [];
  const blockquoteInlineCodeContents: string[] = [];

  visitParents(tree, (node, ancestors: Parent[]) => {
    if (hasBlockquoteAncestor(ancestors)) {
      // blockquote 内の code は通常カウント対象外、別経路で byte-identical 検証
      if (node.type === 'code') {
        // 言語タグ (node.lang) と fence 種別 (``` か ~~~) も比較対象に含める。
        // LLM が ```ts → ```javascript / ```ts → ~~~ts のように書き換えても検出できる。
        // remark は ``` と ~~~ を同一 code ノードに正規化するため、AST 値だけでは fence 種別の差を見抜けない。
        // markdown.slice() で生テキストを取得して fence 文字を判定する
        const lang = node.lang ?? '';
        const startOffset = node.position?.start.offset;
        const endOffset = node.position?.end.offset;
        let fenceChar = '`';
        if (startOffset != null && endOffset != null) {
          // blockquote 内では `> ` プレフィックスが混じるため、最初の ` または ~ を探す
          const raw = markdown.slice(startOffset, endOffset);
          const m = /[`~]/.exec(raw);
          if (m) fenceChar = m[0];
        }
        blockquoteCodeContents.push(`${fenceChar}:${lang}:\n${node.value}`);
        return;
      }
      // blockquote 内のインラインコードは通常カウントにも含めるが、
      // code-extractor も抽出対象外で LLM が直接扱うため、内容も別途 byte 比較する
      if (node.type === 'inlineCode') {
        blockquoteInlineCodeContents.push(node.value);
        // fall-through して通常 inlineCodes カウントもインクリメント
      }
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
    blockquoteInlineCodeContents,
  };
}

export function countStructure(markdown: string): StructureCounts {
  return snapshotStructureInternal(markdown).counts;
}

export function validateStructure(source: string, target: string): ValidationResult {
  const src = snapshotStructureInternal(source);
  const tgt = snapshotStructureInternal(target);
  const mismatches: StructureMismatch[] = [];

  // inlineCodes は count check しない: LLM は backtick 識別子を追加/補正することがあり
  // (例: ja source の informal \`active\` → en で正規変数名 \`waiting\` に補正、TS boolean を
  // \`true\` で wrap 等)、これらは品質改善方向の有用な変化であって corruption ではない。
  // 識別子の semantic な改変 (例: \`Signal\` → \`Observable\`) は proofreader rule 1 が検出する
  const kinds: (keyof StructureCounts)[] = ['codeBlocks', 'images', 'links', 'bareUrlParagraphs'];
  for (const kind of kinds) {
    if (src.counts[kind] !== tgt.counts[kind]) {
      mismatches.push({ kind, source: src.counts[kind], target: tgt.counts[kind] });
    }
  }

  // コードブロック（blockquote 外）の内容比較は実施しない:
  // code-translator でコメントのみ翻訳されるため byte 内容は意図的に異なる

  // blockquote 内コードはプレースホルダ化されず LLM プロンプトに直接渡るため、byte 一致を検証する。
  // 順序を含めた完全一致を要求（contents 配列の長さ・各要素の byte 一致）。
  // count 差異と content 差異は別物なので differKind で区別する（フィードバックメッセージで使い分け）。
  // content 差異の場合は差異件数を source/target に格納して LLM が修正範囲を把握できるようにする
  const srcBq = src.blockquoteCodeContents;
  const tgtBq = tgt.blockquoteCodeContents;
  if (srcBq.length !== tgtBq.length) {
    mismatches.push({
      kind: 'blockquoteCodeContent',
      source: srcBq.length,
      target: tgtBq.length,
      differKind: 'count',
    });
  } else {
    const differingIndices = srcBq.map((v, i) => (v !== tgtBq[i] ? i : -1)).filter((i) => i >= 0);
    if (differingIndices.length > 0) {
      mismatches.push({
        kind: 'blockquoteCodeContent',
        source: srcBq.length,
        target: tgtBq.length,
        differKind: 'content',
        differingCount: differingIndices.length,
      });
    }
  }

  // blockquote 内インラインコードも code-extractor で抽出されないため LLM が直接扱う。
  // 内容を byte 比較する（順序依存）。
  // count 差異も明示的に報告する: blockquote 内/外でインラインコードが移動するケース
  // （例: blockquote 内 `foo` 削除 + 外で 1 個追加で総数同じ）は inlineCodes カウントだけでは検出できない
  const srcBqInline = src.blockquoteInlineCodeContents;
  const tgtBqInline = tgt.blockquoteInlineCodeContents;
  if (srcBqInline.length !== tgtBqInline.length) {
    mismatches.push({
      kind: 'blockquoteInlineCodeContent',
      source: srcBqInline.length,
      target: tgtBqInline.length,
      differKind: 'count',
    });
  } else {
    const differingInline = srcBqInline.map((v, i) => (v !== tgtBqInline[i] ? i : -1)).filter((i) => i >= 0);
    if (differingInline.length > 0) {
      mismatches.push({
        kind: 'blockquoteInlineCodeContent',
        source: srcBqInline.length,
        target: tgtBqInline.length,
        differKind: 'content',
        differingCount: differingInline.length,
      });
    }
  }

  return { ok: mismatches.length === 0, source: src.counts, target: tgt.counts, mismatches };
}
