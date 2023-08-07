export type Node<T extends string = string> = {
  readonly type: T;
  readonly children?: Node[];
};

export type ContentNode =
  | TextNode
  | ParagraphNode
  | HeadingNode
  | DividerNode
  | QuoteNode
  | EmbedNode
  | StackblitzNode
  | TweetNode
  | LinkPreviewNode
  | ImageNode
  | CalloutNode
  | BulletedListNode
  | NumberedListNode
  | DetailsNode
  | YoutubeNode
  | EquationNode
  | TableNode
  | CodeNode;

export type TextNode = Node<'text'> & {
  readonly text: string;
  readonly href?: string;
  readonly equation?: boolean;
  readonly annotations: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
};

export type TextNodeArray = TextNode[];

export type ParagraphNode = Node<'paragraph'> & {
  readonly text: TextNodeArray;
};

export type HeadingNode = Node<'heading'> & {
  readonly level: 1 | 2 | 3;
  readonly text: TextNodeArray;
};

export type DividerNode = Node<'divider'> & {};

export type QuoteNode = Node<'quote'> & {
  readonly text: TextNodeArray;
};

export type EmbedNode = Node<'embed'> & {
  readonly url: string;
};

export type StackblitzNode = Node<'stackblitz'> & {
  readonly url: string;
};

export type TweetNode = Node<'tweet'> & {
  readonly url: string;
};

export type LinkPreviewNode = Node<'link_preview'> & {
  readonly url: string;
};

export type ImageNode = Node<'image'> & {
  readonly url: string;
  readonly caption: TextNodeArray | string;
};

export type CalloutNode = Node<'callout'> & {
  readonly text: TextNodeArray;
};

export type YoutubeNode = Node<'youtube'> & {
  readonly videoId: string;
};

export type EquationNode = Node<'equation'> & {
  readonly expression: string;
};

export type DetailsNode = Node<'details'> & {
  readonly text: TextNodeArray;
  readonly children: ContentNode[];
};

export type CodeNode = Node<'code'> & {
  readonly language: string;
  readonly filename?: string;
  readonly text: string;
};

export type BulletedListNode = Node<'bulleted_list'> & {
  readonly items: {
    readonly text: TextNodeArray;
    readonly children: ContentNode[];
  }[];
};

export type NumberedListNode = Node<'numbered_list'> & {
  readonly items: {
    readonly text: TextNodeArray;
    readonly children: ContentNode[];
  }[];
};

export type TableNode = Node<'table'> & {
  readonly header?: TextNodeArray[];
  readonly rows: TextNodeArray[][];
};
