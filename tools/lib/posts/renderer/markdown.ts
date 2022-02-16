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

type RichText = Array<RichTextNode>;

export const heading = (text: RichText, level: 1 | 2 | 3) => `${'#'.repeat(level)} ${decorateText(text)}\n\n`;
export const paragraph = (text: RichText) => `${decorateText(text)}\n\n`;

export const codeBlock = (text: RichText, language?: string) => {
  const delimiter = '```';
  return `${delimiter}${language ?? ''}\n${plainText(text)}\n${delimiter}\n\n`;
};

export const bulletedListItem = (text: RichText, contents: string[]) => {
  return `- ${decorateText(text)}\n${contents.map(indent).join('')}`;
};

export const numberedListItem = (text: RichText, contents: string[]) => {
  return `1. ${decorateText(text)}\n${contents.map(indent).join('')}`;
};

export const quote = (text: RichText) => `> ${decorateText(text)}\n\n`;

export const divider = () => '---\n\n';

export const linkPreview = (url: string) => `{{< embed "${url}" >}}\n\n`;

export const callout = (text: RichText, emojiIcon?: string) => {
  if (emojiIcon) {
    return `{{< callout "${emojiIcon}">}}\n${decorateText(text)}\n{{< /callout >}}\n\n`;
  } else {
    return `{{< callout >}}\n${decorateText(text)}\n{{< /callout >}}\n\n`;
  }
};

export const image = (url: string, caption: RichText) => {
  return `{{< figure src="${url}" caption="${decorateText(caption)}" >}}\n\n`;
};

export const equation = (expression: string) => {
  return `$$\n${expression}\n$$\n\n`;
};

function indent(text: string): string {
  return `\t${text}`;
}

function decorateText(text: RichText): string {
  const renderNode = (node: RichTextNode): string => {
    const { type, plain_text, href, annotations } = node;
    if (type === 'mention') {
      // mention is only available in Notion
      return '';
    }
    if (type === 'equation') {
      return `$${plain_text}$`;
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
    return plain_text;
  };

  return text.map(renderNode).join('');
}

function plainText(text: RichText): string {
  return text.map((node) => node.plain_text).join('');
}
