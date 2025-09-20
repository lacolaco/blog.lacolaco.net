import { createHash } from 'node:crypto';
import type { PostFrontmatterOut } from '@lib/post';
import { isTweetUrl } from '../shared/embed';
import type { RichTextArray, RichTextItemObject, SpecificBlockObject, UntypedBlockObject } from './notion-types';
import { isListBlock } from './notion-types';

export interface TransformContext {
  readonly slug: string;
  imageDownloads: Array<{
    filename: string;
    url: string;
  }>;
  features: NonNullable<PostFrontmatterOut['features']>;
}

export function newTransformContext(slug: string): TransformContext {
  return {
    slug,
    imageDownloads: [],
    features: {
      katex: false,
      mermaid: false,
      tweet: false,
    },
  };
}

/**
 * NotionブロックをMarkdown文字列に変換する純粋関数
 */
export function transformNotionBlocksToMarkdown(blocks: UntypedBlockObject[], context: TransformContext): string {
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
      const markdown = transformBlock(block, context, listContext.counter);
      listContext.items.push(markdown.trim());
    } else if (block.type === 'table') {
      // テーブルの処理：tableブロックのchildrenからtable_rowを取得
      const blockWithChildren = block as typeof block & { children?: SpecificBlockObject[] };
      const tableRows = (blockWithChildren.children || []).filter((child) => child.type === 'table_row');
      const markdown = transformTable(block, tableRows, context);
      result.push(markdown);
    } else {
      const markdown = transformBlock(block, context);
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

function transformTable(
  tableBlock: SpecificBlockObject,
  tableRows: SpecificBlockObject[],
  context: TransformContext,
): string {
  if (tableRows.length === 0) {
    return '';
  }

  // Type narrowing: tableBlock is already checked to be a table block
  if (tableBlock.type !== 'table') {
    throw new Error(`Expected table block, got ${tableBlock.type}`);
  }

  const tableWidth = tableBlock.table.table_width || 0;
  const hasColumnHeader = tableBlock.table.has_column_header || false;
  const rows: string[] = [];

  // ヘッダー行なしの場合は空のヘッダー行を追加
  if (!hasColumnHeader) {
    const emptyHeader = `| ${Array(tableWidth).fill('').join(' | ')} |`;
    rows.push(emptyHeader);
    const separator = `| ${Array(tableWidth).fill('---').join(' | ')} |`;
    rows.push(separator);
  }

  // テーブル行を処理
  for (let i = 0; i < tableRows.length; i++) {
    const tableRow = tableRows[i];
    if (tableRow.type !== 'table_row') {
      continue;
    }

    const cells = tableRow.table_row.cells;
    const cellTexts = cells.map((cell) => transformRichText(cell, context).replace(/\|/g, '\\|')); // パイプをエスケープ

    // セルが不足している場合は空文字で埋める
    while (cellTexts.length < tableWidth) {
      cellTexts.push('');
    }

    const row = `| ${cellTexts.join(' | ')} |`;
    rows.push(row);

    // ヘッダー行の後にセパレーターを追加
    if (i === 0 && hasColumnHeader) {
      const separator = `| ${Array(tableWidth).fill('---').join(' | ')} |`;
      rows.push(separator);
    }
  }

  return rows.join('\n') + '\n\n';
}

function transformBlock(block: UntypedBlockObject, context: TransformContext, listNumber?: number): string {
  switch (block.type) {
    case 'heading_1': {
      return `# ${transformRichText(block.heading_1.rich_text, context)}\n\n`;
    }

    case 'heading_2': {
      return `## ${transformRichText(block.heading_2.rich_text, context)}\n\n`;
    }

    case 'heading_3': {
      return `### ${transformRichText(block.heading_3.rich_text, context)}\n\n`;
    }

    case 'paragraph': {
      if (block.paragraph.rich_text.length === 0) {
        // 空の段落は無視する
        return '';
      }
      return `${transformRichText(block.paragraph.rich_text, context)}\n\n`;
    }

    case 'divider': {
      return `---\n\n`;
    }
    case 'quote': {
      const content = transformRichText(block.quote.rich_text, context);
      const blockWithChildren = block as typeof block & { children?: SpecificBlockObject[] };

      if (blockWithChildren.children && blockWithChildren.children.length > 0) {
        // 子要素がある場合は複数行引用として処理
        const lines = [`> ${content}`];

        for (let i = 0; i < blockWithChildren.children.length; i++) {
          const child = blockWithChildren.children[i];
          const childMarkdown = transformBlock(child, context);
          const childLines = childMarkdown.trim().split('\n');

          // 最初の子要素の前に空行を追加
          if (i === 0) {
            lines.push('>');
          }

          // 各行に '> ' プレフィックスを追加
          for (const line of childLines) {
            if (line.trim() === '') {
              lines.push('>');
            } else {
              lines.push(`> ${line}`);
            }
          }

          // 最後の子要素でない場合、次の子要素が段落なら空行を追加
          if (i < blockWithChildren.children.length - 1) {
            const nextChild = blockWithChildren.children[i + 1];
            if (nextChild.type === 'paragraph') {
              lines.push('>');
            }
          }
        }

        return lines.join('\n') + '\n\n';
      } else {
        // 単純な引用
        return `> ${content}\n\n`;
      }
    }

    case 'code': {
      let language = block.code.language === 'plain text' ? '' : block.code.language;
      if (language === 'typescript') {
        language = 'ts';
      }
      // marmeidのコードブロックがあった場合はfeatureを有効にする
      if (language === 'mermaid') {
        context.features.mermaid = true;
      }
      const code = transformRichText(block.code.rich_text, context);
      const delimiter = code.includes('```') ? '````' : '```';
      return `${delimiter}${language}\n${code}\n${delimiter}\n\n`;
    }

    case 'image': {
      const caption = transformRichText(block.image.caption, context);
      if (block.image.type === 'external') {
        if (caption) {
          return `<figure>\n  <img src="${block.image.external.url}" alt="${caption}">\n  <figcaption>${caption}</figcaption>\n</figure>\n\n`;
        } else {
          return `![image](${block.image.external.url})\n\n`;
        }
      } else {
        // ローカル画像の場合はレポジトリにダウンロードする
        const imageUrl = block.image.file.url;
        const urlObj = new URL(imageUrl);
        const pathSegments = urlObj.pathname.split('/').filter((segment) => segment.length > 0);

        // ファイル名形式: <元ファイル名>-<ハッシュ>.<拡張子>
        const originalFilename = pathSegments[pathSegments.length - 1] || 'image.png';

        // 元ファイル名から名前と拡張子を分離
        const dotIndex = originalFilename.lastIndexOf('.');
        const baseName = dotIndex !== -1 ? originalFilename.substring(0, dotIndex) : originalFilename;
        const extension = dotIndex !== -1 ? originalFilename.substring(dotIndex) : '.png';

        // ファイルURLのクエリパラメータを除いた部分からSHA-1ハッシュ値を生成（最初の8文字を使用）
        const hashSource = urlObj.origin + urlObj.pathname;
        const hash = createHash('sha1').update(hashSource).digest('hex').substring(0, 8);

        const filename = `${baseName}-${hash}${extension}`;
        context.imageDownloads.push({ filename, url: imageUrl });
        const imageSrc = `/images/${context.slug}/${filename}`;

        if (caption) {
          return `<figure>\n  <img src="${imageSrc}" alt="${caption}">\n  <figcaption>${caption}</figcaption>\n</figure>\n\n`;
        } else {
          return `![image](${imageSrc})\n\n`;
        }
      }
    }

    case 'bulleted_list_item': {
      const content = transformRichText(block.bulleted_list_item.rich_text, context);
      const blockWithChildren = block as typeof block & { children?: SpecificBlockObject[] };
      if (blockWithChildren.children && blockWithChildren.children.length > 0) {
        const nestedContent = transformNotionBlocksToMarkdown(blockWithChildren.children, context);
        const indentedNested = nestedContent
          .trim()
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n');
        return `- ${content}\n${indentedNested}`;
      }
      return `- ${content}`;
    }

    case 'numbered_list_item': {
      const number = listNumber || 1;
      const content = transformRichText(block.numbered_list_item.rich_text, context);
      const blockWithChildren = block as typeof block & { children?: SpecificBlockObject[] };
      if (blockWithChildren.children && blockWithChildren.children.length > 0) {
        const nestedContent = transformNotionBlocksToMarkdown(blockWithChildren.children, context);
        const indentedNested = nestedContent
          .trim()
          .split('\n')
          .map((line) => `   ${line}`)
          .join('\n');
        return `${number}. ${content}\n${indentedNested}`;
      }
      return `${number}. ${content}`;
    }

    case 'equation': {
      // katex機能を有効にする
      context.features.katex = true;
      return `$$\n${block.equation.expression || ''}\n$$\n\n`;
    }

    case 'callout': {
      const alertType = getAlertTypeFromIcon(block.callout.icon || null);
      const content = transformRichText(block.callout.rich_text, context);
      const lines = content.split('\n').filter((line) => line.trim());

      if (lines.length === 1) {
        return `> [!${alertType}]\n> ${lines[0]}\n\n`;
      } else {
        const firstLine = `> [!${alertType}]`;
        const remainingLines = lines.map((line) => `> ${line}`).join('\n');
        return `${firstLine}\n${remainingLines}\n\n`;
      }
    }

    case 'toggle': {
      const summary = transformRichText(block.toggle.rich_text, context);
      const blockWithChildren = block as typeof block & { children?: SpecificBlockObject[] };
      if (blockWithChildren.children && blockWithChildren.children.length > 0) {
        const nestedContent = transformNotionBlocksToMarkdown(blockWithChildren.children, context);
        return `<details>\n<summary>${summary}</summary>\n\n${nestedContent.trim()}\n\n</details>\n\n`;
      }
      return `<details>\n<summary>${summary}</summary>\n\n</details>\n\n`;
    }

    case 'link_preview': {
      return `${block.link_preview.url || ''}\n\n`;
    }

    case 'embed': {
      const url = block.embed.url || '';
      // Twitter URLの場合はtweet機能を有効にする
      if (isTweetUrl(url)) {
        context.features.tweet = true;
      }
      return `${url}\n\n`;
    }

    case 'video': {
      if (block.video.type === 'external') {
        return `${block.video.external.url || ''}\n\n`;
      }
      return `<!-- Unsupported video type -->\n\n`;
    }

    case 'bookmark': {
      return `${block.bookmark.url || ''}\n\n`;
    }

    default: {
      // 未対応のブロックタイプはHTMLコメントでブロックタイプを埋め込み
      return `<!-- Unsupported block type: ${block.type} -->\n\n`;
    }
  }
}

function transformRichText(richText: RichTextArray, context: TransformContext): string {
  return richText.map((item) => transformRichTextNode(item, context)).join('');
}

function transformRichTextNode(node: RichTextItemObject, context: TransformContext): string {
  const text = node.plain_text;

  // 数式の処理（NotionのインラインEquationブロック）
  if ('type' in node && node.type === 'equation') {
    context.features.katex = true;
    const equationNode = node as Record<string, unknown>;
    const equation = equationNode.equation as Record<string, unknown> | undefined;
    return `$${(equation?.expression as string) || ''}$`;
  }

  // 末尾の改行コードを保存して除去
  const trailingNewlines = text.match(/\n+$/)?.[0] || '';
  const textWithoutTrailingNewlines = text.replace(/\n+$/, '');

  let processedText = textWithoutTrailingNewlines;

  // リンクの処理
  if (node.href) {
    processedText = `[${processedText}](${node.href})`;
  }

  // 装飾の処理（ネストに対応）
  if (node.annotations.code) {
    processedText = `\`${processedText}\``;
  }

  // 太字と斜体の組み合わせ処理
  if (node.annotations.bold && node.annotations.italic) {
    processedText = `**_${processedText}_**`;
  } else if (node.annotations.bold) {
    processedText = `**${processedText}**`;
  } else if (node.annotations.italic) {
    processedText = `*${processedText}*`;
  }

  if (node.annotations.strikethrough) {
    processedText = `~~${processedText}~~`;
  }

  // 末尾の改行コードを再付加
  return processedText + trailingNewlines;
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

/**
 * RichTextArrayをプレーンテキストに変換する
 */
export function toPlainText(richText: RichTextArray): string {
  return richText.map((item) => item.plain_text).join('');
}
