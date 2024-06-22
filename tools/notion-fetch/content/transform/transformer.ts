import * as notion from '@lib/notion';
import {
  BulletedListNode,
  CalloutNode,
  CodeNode,
  ContentNode,
  DividerNode,
  EmbedNode,
  EquationNode,
  HeadingNode,
  ImageNode,
  LinkPreviewNode,
  NumberedListNode,
  ParagraphNode,
  QuoteNode,
  TableNode,
  TextNode,
  TextNodeArray,
  DetailsNode,
  YoutubeNode,
  TweetNode,
  StackblitzNode,
} from '@lib/post';
import { FileSystem } from '../../file-system';
import { getFile } from '../../utils/fetch';

export function newContentTransformer(page: notion.PageObjectWithContent, imageFS: FileSystem): ContentTransformer {
  return new ContentTransformer(page, imageFS);
}

export class ContentTransformer {
  constructor(
    readonly page: notion.PageObjectWithContent,
    readonly imageFS: FileSystem,
  ) {}

  async transformContent(blocks: notion.BlockObject[]): Promise<ContentNode[]> {
    const nodes: ContentNode[] = [];
    let block = blocks.shift();
    while (block) {
      const result = await this.#transform(block, blocks);
      nodes.push(...[result].flat());
      block = blocks.shift();
    }
    return nodes;
  }

  transformTitle(block: notion.PageProperty<'title'>): string {
    return this.#plaintext(block.title);
  }

  async #transform(block: notion.BlockObject, blocks: notion.BlockObject[]): Promise<ContentNode | ContentNode[]> {
    switch (block.type) {
      case 'heading_1':
        return this.#heading1(block);
      case 'heading_2':
        return this.#heading2(block);
      case 'heading_3':
        return this.#heading3(block);
      case 'paragraph':
        return this.#paragraph(block);
      case 'divider':
        return this.#divider();
      case 'quote':
        return this.#quote(block);
      case 'bookmark':
        return this.#bookmark(block);
      case 'code':
        return this.#code(block);
      case 'bulleted_list_item':
        return this.#bulletedListItem(block, blocks);
      case 'numbered_list_item':
        return this.#numberedListItem(block, blocks);
      case 'callout':
        return this.#callout(block);
      case 'image':
        return this.#image(block);
      case 'video':
        return this.#video(block);
      case 'equation':
        return this.#equation(block);
      case 'toggle':
        return this.#toggle(block);
      case 'embed':
        return this.#embed(block);
      case 'link_preview':
        return this.#linkPreview(block);
      case 'table':
        return this.#table(block);
      default:
        throw new Error(`Unknown block type: ${block.type}`);
    }
  }

  async #childNodes(block: notion.BlockObject): Promise<ContentNode[]> {
    return this.transformContent(block.children ?? []);
  }

  #plaintext(text: notion.RichTextArray): string {
    return text.map((node) => node.plain_text).join('');
  }

  #richtext(textArray: notion.RichTextArray): TextNodeArray {
    return textArray.map((node) => this.#text(node));
  }

  #text(text: notion.RichTextNode): TextNode {
    return {
      type: 'text',
      text: text.plain_text,
      href: text.href || undefined,
      equation: text.type === 'equation' || undefined,
      annotations: {
        bold: text.annotations.bold || undefined,
        italic: text.annotations.italic || undefined,
        strikethrough: text.annotations.strikethrough || undefined,
        underline: text.annotations.underline || undefined,
        code: text.annotations.code || undefined,
      },
    };
  }

  #paragraph(block: notion.BlockObject<'paragraph'>): ParagraphNode {
    return { type: 'paragraph', text: this.#richtext(block.paragraph.rich_text) };
  }

  #heading1(block: notion.BlockObject<'heading_1'>): HeadingNode {
    return { type: 'heading', level: 1, text: this.#richtext(block.heading_1.rich_text) };
  }

  #heading2(block: notion.BlockObject<'heading_2'>): HeadingNode {
    return { type: 'heading', level: 2, text: this.#richtext(block.heading_2.rich_text) };
  }

  #heading3(block: notion.BlockObject<'heading_3'>): HeadingNode {
    return { type: 'heading', level: 3, text: this.#richtext(block.heading_3.rich_text) };
  }

  #divider(): DividerNode {
    return { type: 'divider' };
  }

  #quote(block: notion.BlockObject<'quote'>): QuoteNode {
    return { type: 'quote', text: this.#richtext(block.quote.rich_text) };
  }

  #bookmark(block: notion.BlockObject<'bookmark'>): LinkPreviewNode | EmbedNode {
    const parsedUrl = new URL(block.bookmark.url);
    // Google slide (pub->embed replace)
    if (parsedUrl.host === 'docs.google.com' && /^\/presentation\/.+\/pub$/.test(parsedUrl.pathname)) {
      const src = parsedUrl.toString().replace('/pub', '/embed');
      return { type: 'embed', url: src };
    }
    return {
      type: 'link_preview',
      url: block.bookmark.url,
    };
  }

  #embed(block: notion.BlockObject<'embed'>): EmbedNode | TweetNode | StackblitzNode {
    const url = new URL(block.embed.url);
    // Stackblitz
    if (url.host === 'stackblitz.com' && url.searchParams.get('embed') === '1') {
      return { type: 'stackblitz', url: url.toString() };
    }
    // Twitter status
    if (url.host === 'twitter.com' && url.pathname.includes('/status/')) {
      return { type: 'tweet', url: url.toString() };
    }

    return { type: 'embed', url: block.embed.url };
  }

  #linkPreview(block: notion.BlockObject<'link_preview'>): LinkPreviewNode {
    return { type: 'link_preview', url: block.link_preview.url };
  }

  async #image(block: notion.BlockObject<'image'>): Promise<ImageNode> {
    if (block.image.type === 'external') {
      return {
        type: 'image',
        external: true,
        url: block.image.external.url,
        caption: this.#plaintext(block.image.caption),
      };
    }
    const url = block.image.file.url;
    const [fileId, ext] = new URL(url).pathname.match(/^(.+)\/.+\.(.+)$/)?.slice(1) ?? [];
    if (fileId == null) {
      throw new Error(`Invalid image url: ${url}`);
    }
    const filepath = `${this.page.slug}${fileId}.${ext}`;
    const file = await getFile(url);
    await this.imageFS.save(filepath, file);
    return {
      type: 'image',
      external: false,
      path: filepath,
      caption: this.#plaintext(block.image.caption),
    };
  }

  #callout(block: notion.BlockObject<'callout'>): CalloutNode {
    return { type: 'callout', text: block.callout.rich_text.map(this.#text) };
  }

  #video(block: notion.BlockObject<'video'>): YoutubeNode {
    if (block.video.type === 'external') {
      const url = new URL(block.video.external.url);
      // YouTube
      if (url.host === 'www.youtube.com' && url.searchParams.has('v')) {
        return { type: 'youtube', videoId: url.searchParams.get('v')! };
      }
    }
    console.error(block);
    throw new Error('Not implemented video type');
  }

  #equation(block: notion.BlockObject<'equation'>): EquationNode {
    return { type: 'equation', expression: block.equation.expression };
  }

  async #toggle(block: notion.BlockObject<'toggle'>): Promise<DetailsNode> {
    return {
      type: 'details',
      text: this.#richtext(block.toggle.rich_text),
      children: await this.#childNodes(block),
    };
  }

  #code(block: notion.BlockObject<'code'>): CodeNode {
    const language = block.code.language.replace('plain text', '') ?? '';
    return {
      type: 'code',
      language,
      filename: this.#plaintext(block.code.caption),
      text: this.#plaintext(block.code.rich_text),
    };
  }

  async #bulletedListItem(
    block: notion.BlockObject<'bulleted_list_item'>,
    blocks: notion.BlockObject[],
    list?: BulletedListNode,
  ): Promise<BulletedListNode> {
    if (!list) {
      list = { type: 'bulleted_list', items: [] };
    }
    const item = {
      type: 'bulleted_list_item',
      text: this.#richtext(block.bulleted_list_item.rich_text),
      children: await this.#childNodes(block),
    };
    list.items.push(item);

    while (blocks[0]?.type === 'bulleted_list_item') {
      const nextItem = blocks.shift() as notion.BlockObject<'bulleted_list_item'>;
      await this.#bulletedListItem(nextItem, blocks, list);
    }

    return list;
  }

  async #numberedListItem(
    block: notion.BlockObject<'numbered_list_item'>,
    blocks: notion.BlockObject[],
    list?: NumberedListNode,
  ): Promise<NumberedListNode> {
    if (!list) {
      list = { type: 'numbered_list', items: [] };
    }
    const item = {
      type: 'bulleted_list_item',
      text: this.#richtext(block.numbered_list_item.rich_text),
      children: await this.#childNodes(block),
    };
    list.items.push(item);

    while (blocks[0]?.type === 'numbered_list_item') {
      const nextItem = blocks.shift() as notion.BlockObject<'numbered_list_item'>;
      await this.#numberedListItem(nextItem, blocks, list);
    }

    return list;
  }

  async #table(block: notion.BlockObject<'table'>): Promise<TableNode> {
    if (block.children == null) {
      throw new Error('Table block has no children');
    }
    const rows = block.children as notion.BlockObject<'table_row'>[];
    const headerRow = block.table.has_row_header ? rows.shift() : undefined;
    return {
      type: 'table',
      header: headerRow ? headerRow.table_row.cells.map((cell) => this.#richtext(cell)) : undefined,
      rows: rows.map((row) => row.table_row.cells.map((cell) => this.#richtext(cell))),
    };
  }
}
