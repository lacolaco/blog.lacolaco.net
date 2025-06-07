import type { SpecificBlockObject, RichTextArray, RichTextItemObject, UntypedBlockObject } from './notion-types';
import {
  isListBlock,
  getHeadingRichText,
  getParagraphRichText,
  getQuoteRichText,
  getCodeProperties,
  getImageProperties,
  getBulletedListItemRichText,
  getNumberedListItemRichText,
  getEquationExpression,
  getCalloutRichText,
  getTableProperties,
  getTableRowCells,
} from './notion-types';

/**
 * NotionブロックをMarkdown文字列に変換する純粋関数
 */
export function transformNotionBlocksToMarkdown(blocks: UntypedBlockObject[]): string {
  const result: string[] = [];
  let listContext: { type: 'bulleted' | 'numbered'; items: string[]; counter: number } | null = null;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // リストの連続性をチェック
    if (listContext && !isListBlock(block)) {
      // リストが終了したので出力
      result.push(formatList(listContext) + '\n\n');
      listContext = null;
    }

    if (isListBlock(block)) {
      const listType = block.type === 'bulleted_list_item' ? 'bulleted' : 'numbered';

      if (!listContext || listContext.type !== listType) {
        // 新しいリストの開始
        if (listContext) {
          result.push(formatList(listContext) + '\n\n');
        }
        listContext = { type: listType, items: [], counter: 0 };
      }

      listContext.counter++;
      const markdown = transformBlock(block, listContext.counter);
      listContext.items.push(markdown.trim());
    } else if (block.type === 'table') {
      // テーブルの処理：tableブロックのchildrenからtable_rowを取得
      const blockWithChildren = block as typeof block & { children?: SpecificBlockObject[] };
      const tableRows = (blockWithChildren.children || []).filter((child) => child.type === 'table_row');
      const markdown = transformTable(block, tableRows);
      result.push(markdown);
    } else {
      const markdown = transformBlock(block);
      result.push(markdown);
    }
  }

  // 最後のリストを処理
  if (listContext) {
    result.push(formatList(listContext) + '\n\n');
  }

  return result.join('');
}

function formatList(listContext: { type: 'bulleted' | 'numbered'; items: string[] }): string {
  return listContext.items.join('\n');
}

function transformTable(tableBlock: SpecificBlockObject, tableRows: SpecificBlockObject[]): string {
  if (tableRows.length === 0) {
    return '';
  }

  const tableProps = getTableProperties(tableBlock);
  const rows: string[] = [];

  // ヘッダー行なしの場合は空のヘッダー行を追加
  if (!tableProps.has_column_header) {
    const emptyHeader = `| ${Array(tableProps.table_width).fill(' ').join(' | ')} |`;
    rows.push(emptyHeader);
    const separator = `| ${Array(tableProps.table_width).fill('---').join(' | ')} |`;
    rows.push(separator);
  }

  // テーブル行を処理
  for (let i = 0; i < tableRows.length; i++) {
    const cells = getTableRowCells(tableRows[i]);
    const cellTexts = cells.map((cell) => transformRichText(cell).replace(/\|/g, '\\|')); // パイプをエスケープ

    // セルが不足している場合は空文字で埋める
    while (cellTexts.length < tableProps.table_width) {
      cellTexts.push('');
    }

    const row = `| ${cellTexts.join(' | ')} |`;
    rows.push(row);

    // ヘッダー行の後にセパレーターを追加
    if (i === 0 && tableProps.has_column_header) {
      const separator = `| ${Array(tableProps.table_width).fill('---').join(' | ')} |`;
      rows.push(separator);
    }
  }

  return rows.join('\n') + '\n\n';
}

function transformBlock(block: UntypedBlockObject, listNumber?: number): string {
  switch (block.type) {
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const level = block.type === 'heading_1' ? 1 : block.type === 'heading_2' ? 2 : 3;
      const headingPrefix = '#'.repeat(level);
      return `${headingPrefix} ${transformRichText(getHeadingRichText(block))}\n\n`;
    }

    case 'paragraph':
      return `${transformRichText(getParagraphRichText(block))}\n\n`;

    case 'divider':
      return `---\n\n`;

    case 'quote':
      return `> ${transformRichText(getQuoteRichText(block))}\n\n`;

    case 'code': {
      const codeProps = getCodeProperties(block);
      const language = codeProps.language === 'plain text' ? '' : codeProps.language;
      const code = transformRichText(codeProps.rich_text);
      return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    }

    case 'image': {
      const imageProps = getImageProperties(block);
      const caption = transformRichText(imageProps.caption);
      if (imageProps.type === 'external' && imageProps.external) {
        return `![${caption}](${imageProps.external.url})\n\n`;
      } else {
        // ローカル画像の場合は仮のパスを使用（実装時に調整）
        return `![${caption}](/images/slug/image-id.png)\n\n`;
      }
    }

    case 'bulleted_list_item':
      return `- ${transformRichText(getBulletedListItemRichText(block))}`;

    case 'numbered_list_item': {
      const number = listNumber || 1;
      return `${number}. ${transformRichText(getNumberedListItemRichText(block))}`;
    }

    case 'equation':
      return `$$\n${getEquationExpression(block)}\n$$\n\n`;

    case 'callout':
      return `> [!INFO]\n> ${transformRichText(getCalloutRichText(block))}\n\n`;

    default:
      // 未対応のブロックタイプはHTMLコメントでブロックタイプを埋め込み
      return `<!-- Unsupported block type: ${block.type} -->\n\n`;
  }
}

function transformRichText(richText: RichTextArray): string {
  return richText.map(transformRichTextNode).join('');
}

function transformRichTextNode(node: RichTextItemObject): string {
  let text = node.plain_text;

  // リンクの処理
  if (node.href) {
    text = `[${text}](${node.href})`;
  }

  // 装飾の処理（ネストに対応）
  if (node.annotations.code) {
    text = `\`${text}\``;
  }
  if (node.annotations.bold) {
    text = `**${text}**`;
  }
  if (node.annotations.italic) {
    text = `*${text}*`;
  }
  if (node.annotations.strikethrough) {
    text = `~~${text}~~`;
  }

  return text;
}
