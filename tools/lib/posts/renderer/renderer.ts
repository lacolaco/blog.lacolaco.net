import { format } from 'prettier';
import { BlockObject } from '../../notion';
import { RendererContext } from '../types';
import { isNotNull } from '../utils';
import { renderFrontmatter } from './frontmatter';
import * as md from './markdown';

export function renderPage(
  properties: Record<string, unknown>,
  content: BlockObject[],
  context: RendererContext,
): string {
  const frontmatter = renderFrontmatter(properties);
  const body = content.map((block) => renderBlock(block, context)).join('');
  return format([frontmatter, body].join('\n\n'), {
    parser: 'markdown',
    ...require('../../../../.prettierrc.json'),
  });
}

export function renderBlock(block: BlockObject, context: RendererContext): string | null {
  const stringify = (node: BlockObject, contents: string[]): string | null => {
    switch (node.type) {
      case 'heading_1':
        return md.heading(node.heading_1.text, 1);
      case 'heading_2':
        return md.heading(node.heading_2.text, 2);
      case 'heading_3':
        return md.heading(node.heading_3.text, 3);
      case 'paragraph':
        return md.paragraph(node.paragraph.text);
      case 'code':
        return md.codeBlock(node.code.text, node.code.language);
      case 'bulleted_list_item':
        return md.bulletedListItem(node.bulleted_list_item.text, contents);
      case 'numbered_list_item':
        return md.numberedListItem(node.numbered_list_item.text, contents);
      case 'quote':
        return md.quote(node.quote.text);
      case 'divider':
        return md.divider();
      case 'bookmark':
        return md.linkPreview(node.bookmark.url);
      case 'link_preview':
        return md.linkPreview(node.link_preview.url);
      case 'callout':
        const emojiIcon = node.callout.icon?.type === 'emoji' ? node.callout.icon.emoji : undefined;
        return md.callout(node.callout.text, emojiIcon);
      case 'image':
        switch (node.image.type) {
          case 'external':
            return md.image(node.image.external.url, node.image.caption);
          case 'file':
            const url = node.image.file.url;
            const name = decodeURIComponent(new URL(url).pathname).replace(/^\/secure\.notion-static\.com\//, '');
            const localPath = `${context.slug}/${name}`;
            context.fetchExternalImage({ url, localPath });
            return md.image(`/img/${localPath}`, node.image.caption);
        }
      case 'equation':
        return md.equation(node.equation.expression);
      case 'toggle':
        return md.details(node.toggle.text, contents);
      case 'video':
      case 'table':
      case 'table_row':
      default:
        return `<pre hidden data-blocktype="${node.type}">\n${JSON.stringify(node, null, 2)}\n</pre>\n\n`;
    }
  };

  const visit = (node: BlockObject) => {
    const contents: string[] = node.children?.map((child) => visit(child)).filter(isNotNull) ?? [];
    return stringify(node, contents);
  };
  return visit(block);
}
