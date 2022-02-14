import { BlockObject } from '../notion';
import * as yaml from 'js-yaml';

type BlockObjectType = BlockObject['type'];
type RenderableBlockObjectType = Extract<
  BlockObjectType,
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'paragraph'
  | 'image'
  | 'code'
  | 'bulleted_list_item'
  | 'numbered_list_item'
  | 'quote'
  | 'divider'
  | 'bookmark'
  | 'callout'
>;
type BlockObjectRenderer<T extends BlockObjectType> = (
  block: MatchType<BlockObject, { type: T }>,
) => Promise<string | null> | string | null;
type BlockObjectRendererMap = {
  [T in RenderableBlockObjectType]: BlockObjectRenderer<T>;
};

type ExternalImageResolver = (url: string) => Promise<string>;

export async function renderContentMarkdown(
  content: BlockObject[],
  externalImageResolver: ExternalImageResolver,
): Promise<string> {
  const renderer: BlockObjectRendererMap = {
    heading_1: (block) => `# ${renderRichTextArray(block.heading_1.text)}\n\n`,
    heading_2: (block) => `## ${renderRichTextArray(block.heading_2.text)}\n\n`,
    heading_3: (block) => `### ${renderRichTextArray(block.heading_3.text)}\n\n`,
    paragraph: (block) => {
      return `${block.paragraph.text
        .map((node) => {
          if (node.type !== 'text') {
            return '';
          }
          return renderRichText(node);
        })
        .join('')}\n\n`;
    },
    image: async (block) => {
      switch (block.image.type) {
        case 'external':
          return `![${renderRichTextArray(block.image.caption)}](${block.image.external.url})\n\n`;
        case 'file':
          const imagePath = await externalImageResolver(block.image.file.url);
          return `![${renderRichTextArray(block.image.caption)}](/img/${imagePath})\n\n`;
      }
    },
    code: (block) => {
      const delimiter = '```';
      const text = block.code.text.map((node) => node.plain_text).join('');
      return `${delimiter}${block.code.language}\n${text}\n${delimiter}\n\n`;
    },
    divider: () => '---\n\n',
    quote: (block) => {
      return `> ${renderRichTextArray(block.quote.text)}\n\n`;
    },
    bulleted_list_item: (block) => {
      const indent = '\t'.repeat(block.depth);
      const text = renderRichTextArray(block.bulleted_list_item.text);
      return `${indent}- ${text}\n`;
    },
    numbered_list_item: (block) => {
      const indent = '\t'.repeat(block.depth);
      const text = renderRichTextArray(block.numbered_list_item.text);
      return `${indent}1. ${text}\n`;
    },
    bookmark: (block) => {
      return `{{< embed "${block.bookmark.url}" >}}\n\n`;
    },
    callout: (block) => {
      const emojiIcon = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji : null;
      const text = renderRichTextArray(block.callout.text);
      if (emojiIcon) {
        return `{{< callout "${emojiIcon}">}}\n${text}\n{{< /callout >}}\n\n`;
      } else {
        return `{{< callout >}}\n${text}\n{{< /callout >}}\n\n`;
      }
    },
  } as const;

  const render = async (block: BlockObject): Promise<string> => {
    const fn = (renderer as Record<BlockObjectType, BlockObjectRenderer<any>>)[block.type];
    return (
      (await fn?.(block)) ?? `<pre hidden data-blocktype="${block.type}">\n${JSON.stringify(block, null, 2)}\n</pre>\n`
    );
  };

  const walk = async (block: BlockObject): Promise<string> => {
    if (block.children == null) {
      return render(block);
    }
    return (await Promise.all([render(block), ...block.children.map((child) => walk(child))])).join('');
  };

  return (await Promise.all(content.map(walk))).join('');
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

function renderRichTextArray(array: RichTextObject[]): string {
  return array.map(renderRichText).join('');
}

function renderRichText(richText: RichTextObject): string {
  const { plain_text, href, annotations } = richText;
  if (annotations.code) {
    return `\`${plain_text}\``;
  }
  if (annotations.bold) {
    return renderRichText({
      ...richText,
      plain_text: `**${plain_text}**`,
      annotations: { ...annotations, bold: false },
    });
  }
  if (annotations.italic) {
    const mark = plain_text.startsWith('*') ? '_' : '*';
    return renderRichText({
      ...richText,
      plain_text: `${mark}${plain_text}${mark}`,
      annotations: { ...annotations, italic: false },
    });
  }
  if (annotations.strikethrough) {
    return renderRichText({
      ...richText,
      plain_text: `~~${plain_text}~~`,
      annotations: { ...annotations, strikethrough: false },
    });
  }
  if (annotations.underline) {
    return renderRichText({
      ...richText,
      plain_text: `__${plain_text}__`,
      annotations: { ...annotations, underline: false },
    });
  }
  if (href) {
    return renderRichText({ ...richText, plain_text: `[${plain_text}](${href})`, href: null });
  }
  if (plain_text.includes('\n')) {
    return plain_text.replace(/\n/g, '  \n');
  }
  return plain_text;
}

export function renderFrontmatter(params: Record<string, unknown>): string {
  const frontmatter = yaml.dump(params, { forceQuotes: true });
  return [`---`, frontmatter, `---`].join('\n');
}

export function parseFrontmatter(content: string): Record<string, unknown> {
  const [, frontmatter] = content.split('---\n');
  return yaml.load(frontmatter) as Record<string, unknown>;
}
