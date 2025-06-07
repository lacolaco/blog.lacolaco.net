import type { SpecificBlockObject, RichTextArray, RichTextItemObject, UntypedBlockObject } from './notion-types';
import { isListBlock, getTableProperties, getTableRowCells } from './notion-types';

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
    case 'heading_1': {
      return `# ${transformRichText(block.heading_1?.rich_text || [])}\n\n`;
    }

    case 'heading_2': {
      return `## ${transformRichText(block.heading_2?.rich_text || [])}\n\n`;
    }

    case 'heading_3': {
      return `### ${transformRichText(block.heading_3?.rich_text || [])}\n\n`;
    }

    case 'paragraph': {
      return `${transformRichText(block.paragraph?.rich_text || [])}\n\n`;
    }

    case 'divider': {
      return `---\n\n`;
    }
    case 'quote': {
      return `> ${transformRichText(block.quote?.rich_text || [])}\n\n`;
    }

    case 'code': {
      const language = block.code?.language === 'plain text' ? '' : block.code?.language || '';
      const code = transformRichText(block.code?.rich_text || []);
      return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    }

    case 'image': {
      const caption = transformRichText(block.image?.caption || []);
      if (block.image?.type === 'external' && block.image?.external) {
        return `![${caption}](${block.image.external.url})\n\n`;
      } else {
        // ローカル画像の場合は仮のパスを使用（実装時に調整）
        return `![${caption}](/images/slug/image-id.png)\n\n`;
      }
    }

    case 'bulleted_list_item': {
      return `- ${transformRichText(block.bulleted_list_item?.rich_text || [])}`;
    }

    case 'numbered_list_item': {
      const number = listNumber || 1;
      return `${number}. ${transformRichText(block.numbered_list_item?.rich_text || [])}`;
    }

    case 'equation': {
      return `$$\n${block.equation?.expression || ''}\n$$\n\n`;
    }

    case 'callout': {
      const alertType = getAlertTypeFromIcon(block.callout?.icon || null);
      return `> [!${alertType}]\n> ${transformRichText(block.callout?.rich_text || [])}\n\n`;
    }

    default: {
      // 未対応のブロックタイプはHTMLコメントでブロックタイプを埋め込み
      return `<!-- Unsupported block type: ${block.type} -->\n\n`;
    }
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

function getAlertTypeFromIcon(icon: { type: string; emoji?: string } | null): string {
  if (!icon || icon.type !== 'emoji' || !icon.emoji) {
    return 'NOTE';
  }

  switch (icon.emoji) {
    case '❗️':
    case '❗':
      return 'IMPORTANT';
    case '⚠️':
    case '⚠':
      return 'WARNING';
    default:
      return 'NOTE';
  }
}
