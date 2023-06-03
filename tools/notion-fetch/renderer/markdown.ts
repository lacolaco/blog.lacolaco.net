import type { BlockObject, PageProperty } from '../notion';
import type { RenderContext } from './types';
import { isNotNull } from './utils';

export function renderTitle(block: PageProperty<'title'>): string {
  return plainText(block.title);
}

export async function renderBlock(block: BlockObject, context: RenderContext): Promise<string | null> {
  const render = async (node: BlockObject): Promise<string | null> => {
    switch (node.type) {
      case 'heading_1':
        return h1(node, context);
      case 'heading_2':
        return h2(node, context);
      case 'heading_3':
        return h3(node, context);
      case 'paragraph':
        return paragraph(node, context);
      case 'code':
        return codeblock(node, context);
      case 'bulleted_list_item':
        return ul(node, context);
      case 'numbered_list_item':
        return ol(node, context);
      case 'quote':
        return quote(node, context);
      case 'divider':
        return divider();
      case 'bookmark':
        return bookmark(node, context);
      case 'link_preview':
        return linkPreview(node, context);
      case 'callout':
        return callout(node, context);
      case 'image':
        return image(node, context);
      case 'equation':
        return equation(node, context);
      case 'toggle':
        return toggle(node, context);
      case 'embed':
        return embed(node, context);
      case 'video':
        return video(node, context);
      case 'table':
        return table(node, context);
      case 'table_row':
        return tableRow(node, context);
    }
    return null;
  };

  const visit = async (node: BlockObject) => {
    const html = await render(node);
    return html ?? `<pre hidden data-blocktype="${node.type}">\n{\`${JSON.stringify(node, null, 2)}\`}\n</pre>\n\n`;
  };
  return await visit(block);
}

// Common Markdown Syntax

const h1 = (block: BlockObject<'heading_1'>, context: RenderContext) =>
  `# ${richText(block.heading_1.rich_text, context)}\n\n`;
const h2 = (block: BlockObject<'heading_2'>, context: RenderContext) =>
  `## ${richText(block.heading_2.rich_text, context)}\n\n`;
const h3 = (block: BlockObject<'heading_3'>, context: RenderContext) =>
  `### ${richText(block.heading_3.rich_text, context)}\n\n`;

const paragraph = (block: BlockObject<'paragraph'>, context: RenderContext) =>
  `\n${richText(block.paragraph.rich_text, context)}\n\n`;

const ul = async (block: BlockObject<'bulleted_list_item'>, context: RenderContext) => {
  return list(block.bulleted_list_item.rich_text, '-', block.children ?? [], context);
};
const ol = async (block: BlockObject<'numbered_list_item'>, context: RenderContext) => {
  return list(block.numbered_list_item.rich_text, '1.', block.children ?? [], context);
};
const list = async (text: RichText, marker: string, children: BlockObject[], context: RenderContext) => {
  const contents = (await Promise.all((children ?? []).map((child) => renderBlock(child, context)))).filter(isNotNull);
  return `${marker} ${richText(text, context)}\n${contents.map(indent).join('')}`;
};

const codeblock = (block: BlockObject<'code'>, context: RenderContext) => {
  const code = plainText(block.code.rich_text);
  const language =
    block.code.language
      // mapplng to prismjs language
      .replace('plain text', '') ?? '';
  const caption = plainText(block.code.caption);
  switch (language) {
    case 'mermaid':
      context.features.add('mermaid');
      return `<Mermaid content="${code}" />\n\n`;
    default:
      const delimiter = '```';
      return `${delimiter}${language}${caption ? `:${caption}` : ''}\n${code}\n${delimiter}\n\n`;
  }
};

const quote = (block: BlockObject<'quote'>, context: RenderContext) =>
  `> ${richText(block.quote.rich_text, context)}\n\n`;

const divider = () => '---\n\n';

const table = async (block: BlockObject<'table'>, context: RenderContext) => {
  const hasHeader = block.table.has_column_header;
  const rows = (await Promise.all((block.children ?? []).map((child) => renderBlock(child, context)))).filter(
    isNotNull,
  );
  const columns = rows[0] ? rows[0].split('|').length - 2 : 0;
  const header = hasHeader ? rows.shift() : `|${'|'.repeat(columns)}`;
  const alignment = `|${':--|'.repeat(columns)}`;
  return `${header}${alignment}\n${rows.join('')}\n\n`;
};

const tableRow = async (block: BlockObject<'table_row'>, context: RenderContext) => {
  const cells = (await Promise.all((block.table_row.cells ?? []).map((child) => richText(child, context)))).filter(
    isNotNull,
  );
  return `|${cells.join('|')}|\n`;
};

// Extensions

const callout = (block: BlockObject<'callout'>, context: RenderContext) => {
  context.features.add('callout');
  const text = richText(block.callout.rich_text, context);
  const emojiIcon = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji : undefined;
  if (emojiIcon) {
    return `<Callout icon="${emojiIcon}">\n\n${text}\n\n</Callout>\n\n`;
  } else {
    return `<Callout>\n\n${text}\n\n</Callout>\n\n`;
  }
};

const image = (block: BlockObject<'image'>, context: RenderContext) => {
  context.features.add('figure');
  if (block.image.type === 'file') {
    const url = block.image.file.url;
    const filename = decodeURIComponent(new URL(url).pathname).replace(/^\/secure\.notion-static\.com\//, '');
    context.imageRequests.push({ url, filename });
    return `<Figure src="${context.imagesBasePath}/${filename}" caption="${richText(
      block.image.caption,
      context,
    )}" />\n\n`;
  } else {
    const url = block.image.external.url;
    return `<Figure src="${url}" caption="${richText(block.image.caption, context)}" />\n\n`;
  }
};

const equation = (block: BlockObject<'equation'>, context: RenderContext) => {
  context.features.add('katex');
  const expression = block.equation.expression;
  return `<Katex content="\$\$${expression}\$\$" />\n\n`;
};

const toggle = async (block: BlockObject<'toggle'>, context: RenderContext) => {
  context.features.add('details');
  const contents = (await Promise.all((block.children ?? []).map((child) => renderBlock(child, context)))).filter(
    isNotNull,
  );
  return `<Details summary="${plainText(block.toggle.rich_text)}">\n\n${contents.join('')}\n\n</Details>\n\n`;
};

const linkPreview = (block: BlockObject<'link_preview'>, context: RenderContext) => {
  context.features.add('linkPreview');
  const url = block.link_preview.url;
  return `<LinkPreview src="${url}" />\n\n`;
};

const bookmark = (block: BlockObject<'bookmark'>, context: RenderContext) => {
  const url = new URL(block.bookmark.url);
  // Google slide (pub->embed replace)
  if (url.host === 'docs.google.com' && /^\/presentation\/.+\/pub$/.test(url.pathname)) {
    context.features.add('embed');
    const src = url.toString().replace('/pub', '/embed');
    return `<Embed src="${src}" />\n\n`;
  }
  context.features.add('linkPreview');
  return `<LinkPreview src="${url}" />\n\n`;
};

const embed = async (block: BlockObject<'embed'>, context: RenderContext) => {
  const url = new URL(block.embed.url);
  // Stackblitz
  if (url.host === 'stackblitz.com' && url.searchParams.get('embed') === '1') {
    context.features.add('stackblitz');
    return `<Stackblitz src="${url.toString()}" />\n\n`;
  }
  // Twitter status
  if (url.host === 'twitter.com' && url.pathname.includes('/status/')) {
    context.features.add('tweet');
    return `<Tweet url="${url.toString()}" />\n\n`;
  }
  return null;
};

const video = (block: BlockObject<'video'>, context: RenderContext) => {
  if (block.video.type === 'external') {
    const url = new URL(block.video.external.url);
    // YouTube
    if (url.host === 'www.youtube.com' && url.searchParams.has('v')) {
      context.features.add('youtube');
      return `<Youtube videoId="${url.searchParams.get('v')}" />\n\n`;
    }
  }
  return null;
};

function indent(text: string): string {
  return `\t${text}`;
}
type TextAnnotations = {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
};

type TextNode = {
  type: 'text';
  plain_text: string;
  href: string | null;
  annotations: TextAnnotations;
};

type MentionNode = {
  type: 'mention';
  plain_text: string;
  href: string | null;
  annotations: TextAnnotations;
};

type EquationNode = {
  type: 'equation';
  plain_text: string;
  href: string | null;
  annotations: TextAnnotations;
};

type RichTextNode = TextNode | MentionNode | EquationNode;

export type RichText = Array<RichTextNode>;

function richText(text: RichText, context: RenderContext): string {
  const renderNode = (node: RichTextNode): string => {
    const { type, plain_text, href, annotations } = node;
    if (type === 'mention') {
      // mention is only available in Notion
      return '';
    }
    if (type === 'equation') {
      context.features.add('katex');
      return `<Katex content="\$${plain_text}\$" />\n\n`;
    }
    if (annotations.code) {
      return `\`${plain_text}\``;
    }
    if (annotations.bold) {
      return renderNode({ ...node, plain_text: `**${plain_text}**`, annotations: { ...annotations, bold: false } });
    }
    if (annotations.italic) {
      return renderNode({
        ...node,
        plain_text: plain_text.startsWith('*') ? `_${plain_text}_` : `*${plain_text}*`,
        annotations: { ...annotations, italic: false },
      });
    }
    if (annotations.strikethrough) {
      return renderNode({
        ...node,
        plain_text: `~~${plain_text}~~`,
        annotations: { ...annotations, strikethrough: false },
      });
    }
    if (annotations.underline) {
      return renderNode({
        ...node,
        plain_text: `__${plain_text}__`,
        annotations: { ...annotations, underline: false },
      });
    }
    if (href) {
      return renderNode({ ...node, plain_text: `[${plain_text}](${href})`, href: null });
    }
    if (plain_text.includes('\n')) {
      return plain_text.replace(/\n/g, '  \n');
    }
    return escapeMDX(plain_text);
  };

  return text.map(renderNode).join('');
}

function plainText(text: RichText): string {
  return text.map((node) => node.plain_text).join('');
}

function escapeMDX(html: string): string {
  // MDX escape
  return (
    html
      // escape {}
      .replace(/{/g, '&#123;')
      .replace(/}/g, '&#125;')
      // escape <>
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  );
}
