import { forkJoin, lastValueFrom, Observable } from 'rxjs';
import { BlockObject as AnyBlockObject } from '../notion';
import { ImagesRepository } from './repository';
import { NodeRenderer } from './types';
import { isNotNull } from './utils';

type BlockType = AnyBlockObject['type'];
type BlockObject<T extends BlockType = BlockType> = MatchType<AnyBlockObject, { type: T }>;

class BlockRenderer implements NodeRenderer<BlockObject> {
  private taskQueue: Array<Observable<void>> = [];

  constructor(
    private readonly pageSlug: string,
    private readonly downloadExternalImage: (url: string, localPath: string) => Observable<void>,
  ) {}

  render(block: BlockObject): string | null {
    const visit = (block: BlockObject) => {
      const contents: string[] = block.children?.map((child) => visit(child)).filter(isNotNull) ?? [];
      return this.renderBlock(block, contents);
    };
    return visit(block);
  }

  async waitForStable(): Promise<void> {
    await lastValueFrom(forkJoin(this.taskQueue));
  }

  private renderBlock(block: BlockObject, contents: string[]): string | null {
    switch (block.type) {
      case 'heading_1':
        return `# ${richText(block.heading_1.text)}\n\n`;
      case 'heading_2':
        return `## ${richText(block.heading_2.text)}\n\n`;
      case 'heading_3':
        return `### ${richText(block.heading_3.text)}\n\n`;
      case 'paragraph':
        return `${richText(block.paragraph.text)}\n\n`;
      case 'code':
        const delimiter = '```';
        const language = block.code.language ?? '';
        return `${delimiter}${language}\n${plainText(block.code.text)}\n${delimiter}\n\n`;
      case 'bulleted_list_item':
        return `- ${richText(block.bulleted_list_item.text)}\n${contents.map(indent()).join('')}`;
      case 'numbered_list_item':
        return `1. ${richText(block.numbered_list_item.text)}\n${contents.map(indent()).join('')}`;
      case 'quote':
        return `> ${richText(block.quote.text)}\n\n`;
      case 'divider':
        return `---\n\n`;
      case 'bookmark':
        return `{{< embed "${block.bookmark.url}" >}}\n\n`;
      case 'callout':
        const emojiIcon = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji : null;
        const text = richText(block.callout.text);
        if (emojiIcon) {
          return `{{< callout "${emojiIcon}">}}\n${text}\n{{< /callout >}}\n\n`;
        } else {
          return `{{< callout >}}\n${text}\n{{< /callout >}}\n\n`;
        }
      case 'image':
        switch (block.image.type) {
          case 'external':
            return `![${richText(block.image.caption)}](${block.image.external.url})\n\n`;
          case 'file':
            const url = block.image.file.url;
            const name = decodeURIComponent(new URL(url).pathname).replace(/^\/secure\.notion-static\.com\//, '');
            const localPath = `${this.pageSlug}/${name}`;
            this.addTask(this.downloadExternalImage(url, localPath));
            return `![${richText(block.image.caption)}](/img/${localPath})\n\n`;
        }
      default:
        return `<pre hidden data-blocktype="${block.type}">\n${JSON.stringify(block, null, 2)}\n</pre>\n\n`;
    }
  }

  private addTask(task: Observable<void>) {
    this.taskQueue.push(task);
  }
}

export class PostContentRenderer {
  constructor(private readonly imagesRepo: ImagesRepository) {}

  async render(slug: string, content: BlockObject[]): Promise<string> {
    const renderer = new BlockRenderer(slug, (url, localPath) => this.imagesRepo.download(url, localPath));
    const result = content.map((block) => renderer.render(block)).join('');
    await renderer.waitForStable();
    return result;
  }
}

type RichTextObject = {
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
};

function richText(text: RichTextObject[]): string {
  function renderNode(node: RichTextObject): string {
    const { plain_text, href, annotations } = node;
    if (annotations.code) {
      return `\`${plain_text}\``;
    }
    if (annotations.bold) {
      return renderNode({
        ...node,
        plain_text: `**${plain_text}**`,
        annotations: { ...annotations, bold: false },
      });
    }
    if (annotations.italic) {
      const mark = plain_text.startsWith('*') ? '_' : '*';
      return renderNode({
        ...node,
        plain_text: `${mark}${plain_text}${mark}`,
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
    return plain_text;
  }

  return text.map(renderNode).join('');
}

function plainText(text: RichTextObject[]): string {
  return text.map((node) => node.plain_text).join('');
}

function indent(depth = 1) {
  return (text: string) => '\t'.repeat(depth) + text;
}
