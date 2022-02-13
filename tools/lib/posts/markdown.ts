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
    heading_1: (block) => `# ${block.heading_1.text[0].plain_text}\n\n`,
    heading_2: (block) => `## ${block.heading_2.text[0].plain_text}\n\n`,
    heading_3: (block) => `### ${block.heading_3.text[0].plain_text}\n\n`,
    paragraph: (block) => {
      return `${block.paragraph.text
        .map((node) => {
          if (node.type !== 'text') {
            return '';
          }
          if (node.plain_text === '\n') {
            return '  \n';
          }
          const text = renderTextWithAnnotation(node.plain_text, node.annotations);
          if (node.href) {
            return `[${text}](${node.href})`;
          }
          return text;
        })
        .join('')}\n\n`;
    },
    image: async (block) => {
      switch (block.image.type) {
        case 'external':
          return `![${block.image.caption}](${block.image.external.url})\n\n`;
        case 'file':
          const imagePath = await externalImageResolver(block.image.file.url);
          // TODO: download file and replace with relative path
          return `![${block.image.caption}](/img/${imagePath})\n\n`;
      }
    },
    code: (block) => {
      const delimiter = '```';
      const text = block.code.text.map((node) => node.plain_text).join('');
      return `${delimiter}${block.code.language}\n${text}\n${delimiter}\n\n`;
    },
    divider: () => '---\n\n',
    quote: (block) => {
      return `> ${block.quote.text
        .map((node) => renderTextWithAnnotation(node.plain_text, node.annotations))
        .join('')}\n\n`;
    },
    bulleted_list_item: (block) => {
      const indent = '\t'.repeat(block.depth);
      const text = renderTextWithAnnotation(
        block.bulleted_list_item.text[0].plain_text,
        block.bulleted_list_item.text[0].annotations,
      );
      return `${indent}- ${text}\n`;
    },
    numbered_list_item: (block) => {
      const indent = '\t'.repeat(block.depth);
      const text = renderTextWithAnnotation(
        block.numbered_list_item.text[0].plain_text,
        block.numbered_list_item.text[0].annotations,
      );
      return `${indent}1. ${text}\n`;
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

function renderTextWithAnnotation(
  text: string,
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  },
): string {
  if (annotations.code) {
    return `\`${text}\``;
  }
  if (annotations.bold) {
    return renderTextWithAnnotation(`**${text}**`, { ...annotations, bold: false });
  }
  if (annotations.italic) {
    const mark = text.startsWith('*') ? '_' : '*';
    return renderTextWithAnnotation(`${mark}${text}${mark}`, { ...annotations, italic: false });
  }
  if (annotations.strikethrough) {
    return renderTextWithAnnotation(`~~${text}~~`, { ...annotations, strikethrough: false });
  }
  if (annotations.underline) {
    return renderTextWithAnnotation(`__${text}__`, { ...annotations, underline: false });
  }
  return text;
}

export function renderFrontmatter(params: Record<string, unknown>): string {
  const frontmatter = yaml.dump(params, { forceQuotes: true });
  return [`---`, frontmatter, `---`].join('\n');
}

export function parseFrontmatter(content: string): Record<string, unknown> {
  const [, frontmatter] = content.split('---\n');
  return yaml.load(frontmatter) as Record<string, unknown>;
}
