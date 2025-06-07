/**
 * notion-fetchツール専用のNotionブロック型定義
 * @notionhq/clientの型定義を最大限活用
 */

import type {
  BlockObjectResponse,
  PageObjectResponse,
  DatabaseObjectResponse,
  RichTextItemResponse,
  ParagraphBlockObjectResponse,
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  BulletedListItemBlockObjectResponse,
  NumberedListItemBlockObjectResponse,
  QuoteBlockObjectResponse,
  CodeBlockObjectResponse,
  ImageBlockObjectResponse,
  EquationBlockObjectResponse,
  DividerBlockObjectResponse,
  CalloutBlockObjectResponse,
  VideoBlockObjectResponse,
  ToggleBlockObjectResponse,
  EmbedBlockObjectResponse,
  BookmarkBlockObjectResponse,
  LinkPreviewBlockObjectResponse,
  TableBlockObjectResponse,
  TableRowBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

// @notionhq/clientの型定義を直接使用
export type RichTextArray = RichTextItemResponse[];
export type RichTextNode = RichTextItemResponse;

// ベースとなる型なしブロックオブジェクト
export type UntypedBlockObject = BlockObjectResponse & {
  children?: UntypedBlockObject[];
};

// 各ブロックタイプの個別型定義（@notionhq/client の型を最大限活用）
export type HeadingBlockObject =
  | Heading1BlockObjectResponse
  | Heading2BlockObjectResponse
  | Heading3BlockObjectResponse;
export type ParagraphBlockObject = ParagraphBlockObjectResponse;
export type DividerBlockObject = DividerBlockObjectResponse;
export type QuoteBlockObject = QuoteBlockObjectResponse;
export type CodeBlockObject = CodeBlockObjectResponse;
export type ImageBlockObject = ImageBlockObjectResponse;
export type BulletedListItemBlockObject = BulletedListItemBlockObjectResponse;
export type NumberedListItemBlockObject = NumberedListItemBlockObjectResponse;
export type EquationBlockObject = EquationBlockObjectResponse;
export type CalloutBlockObject = CalloutBlockObjectResponse;
export type VideoBlockObject = VideoBlockObjectResponse;
export type ToggleBlockObject = ToggleBlockObjectResponse;
export type EmbedBlockObject = EmbedBlockObjectResponse;
export type BookmarkBlockObject = BookmarkBlockObjectResponse;
export type LinkPreviewBlockObject = LinkPreviewBlockObjectResponse;
export type TableBlockObject = TableBlockObjectResponse;
export type TableRowBlockObject = TableRowBlockObjectResponse;

// すべてのブロックタイプのユニオン型
export type SpecificBlockObject =
  | HeadingBlockObject
  | ParagraphBlockObject
  | DividerBlockObject
  | QuoteBlockObject
  | CodeBlockObject
  | ImageBlockObject
  | BulletedListItemBlockObject
  | NumberedListItemBlockObject
  | EquationBlockObject
  | CalloutBlockObject
  | VideoBlockObject
  | ToggleBlockObject
  | EmbedBlockObject
  | BookmarkBlockObject
  | LinkPreviewBlockObject
  | TableBlockObject
  | TableRowBlockObject;

// ページプロパティの型定義（@notionhq/clientベース）
export type PageProperties = PageObjectResponse['properties'];

// 特定のプロパティタイプ（型安全性のため）
export type TitleProperty = Extract<PageProperties[string], { type: 'title' }>;
export type RichTextProperty = Extract<PageProperties[string], { type: 'rich_text' }>;
export type SelectProperty = Extract<PageProperties[string], { type: 'select' }>;
export type MultiSelectProperty = Extract<PageProperties[string], { type: 'multi_select' }>;
export type CheckboxProperty = Extract<PageProperties[string], { type: 'checkbox' }>;
export type UrlProperty = Extract<PageProperties[string], { type: 'url' }>;
export type DateProperty = Extract<PageProperties[string], { type: 'date' }>;

// ブログページのプロパティ構造
export interface BlogPageProperties extends Record<string, unknown> {
  title: TitleProperty;
  slug: RichTextProperty;
  locale: SelectProperty;
  category: SelectProperty;
  tags: MultiSelectProperty;
  published: CheckboxProperty;
  canonical_url: UrlProperty;
  created_at_override: DateProperty;
  updated_at: DateProperty;
}

// ブログページオブジェクト
export interface BlogPageObject {
  id: string;
  created_time: string;
  last_edited_time: string;
  object: 'page';
  properties: BlogPageProperties;
  slug: string;
  locale?: 'ja' | 'en';
}

// コンテンツ付きページオブジェクト
export interface PageObjectWithContent extends BlogPageObject {
  content: SpecificBlockObject[];
}

// データベースプロパティ設定（@notionhq/clientベース）
export type DatabaseProperties = DatabaseObjectResponse['properties'];
export type DatabasePropertyConfig<T extends string> = Extract<DatabaseProperties[string], { type: T }>;

// 特定のデータベースプロパティタイプ
export type MultiSelectConfig = Extract<DatabaseProperties[string], { type: 'multi_select' }>;
export type SelectConfig = Extract<DatabaseProperties[string], { type: 'select' }>;

// ブログデータベースのプロパティ構造
export interface BlogDatabaseProperties {
  title: DatabasePropertyConfig<'title'>;
  slug: DatabasePropertyConfig<'rich_text'>;
  locale: SelectConfig;
  category: SelectConfig;
  tags: MultiSelectConfig;
  published: DatabasePropertyConfig<'checkbox'>;
  canonical_url: DatabasePropertyConfig<'url'>;
  created_at_override: DatabasePropertyConfig<'date'>;
  updated_at: DatabasePropertyConfig<'date'>;
}

// 型ガード関数
export function isListBlock(
  block: UntypedBlockObject,
): block is BulletedListItemBlockObject | NumberedListItemBlockObject {
  return block.type === 'bulleted_list_item' || block.type === 'numbered_list_item';
}

export function isHeadingBlock(block: UntypedBlockObject): block is HeadingBlockObject {
  return block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3';
}

export function isParagraphBlock(block: UntypedBlockObject): block is ParagraphBlockObject {
  return block.type === 'paragraph';
}

export function isDividerBlock(block: UntypedBlockObject): block is DividerBlockObject {
  return block.type === 'divider';
}

export function isQuoteBlock(block: UntypedBlockObject): block is QuoteBlockObject {
  return block.type === 'quote';
}

export function isCodeBlock(block: UntypedBlockObject): block is CodeBlockObject {
  return block.type === 'code';
}

export function isImageBlock(block: UntypedBlockObject): block is ImageBlockObject {
  return block.type === 'image';
}

export function isBulletedListItemBlock(block: UntypedBlockObject): block is BulletedListItemBlockObject {
  return block.type === 'bulleted_list_item';
}

export function isNumberedListItemBlock(block: UntypedBlockObject): block is NumberedListItemBlockObject {
  return block.type === 'numbered_list_item';
}

export function isEquationBlock(block: UntypedBlockObject): block is EquationBlockObject {
  return block.type === 'equation';
}

export function isCalloutBlock(block: UntypedBlockObject): block is CalloutBlockObject {
  return block.type === 'callout';
}

export function isVideoBlock(block: UntypedBlockObject): block is VideoBlockObject {
  return block.type === 'video';
}

export function isToggleBlock(block: UntypedBlockObject): block is ToggleBlockObject {
  return block.type === 'toggle';
}

export function isEmbedBlock(block: UntypedBlockObject): block is EmbedBlockObject {
  return block.type === 'embed';
}

export function isBookmarkBlock(block: UntypedBlockObject): block is BookmarkBlockObject {
  return block.type === 'bookmark';
}

export function isLinkPreviewBlock(block: UntypedBlockObject): block is LinkPreviewBlockObject {
  return block.type === 'link_preview';
}

export function isTableBlock(block: UntypedBlockObject): block is TableBlockObject {
  return block.type === 'table';
}

export function isTableRowBlock(block: UntypedBlockObject): block is TableRowBlockObject {
  return block.type === 'table_row';
}

// プロパティアクセス用のヘルパー関数
export function getHeadingRichText(block: SpecificBlockObject): RichTextArray {
  if (!isHeadingBlock(block)) {
    throw new Error(`Block is not a heading block: ${block.type}`);
  }

  if (block.type === 'heading_1') {
    return block.heading_1?.rich_text || [];
  } else if (block.type === 'heading_2') {
    return block.heading_2?.rich_text || [];
  } else if (block.type === 'heading_3') {
    return block.heading_3?.rich_text || [];
  }
  return [];
}

export function getParagraphRichText(block: SpecificBlockObject): RichTextArray {
  if (!isParagraphBlock(block)) {
    throw new Error(`Block is not a paragraph block: ${block.type}`);
  }
  return block.paragraph?.rich_text || [];
}

export function getQuoteRichText(block: SpecificBlockObject): RichTextArray {
  if (!isQuoteBlock(block)) {
    throw new Error(`Block is not a quote block: ${block.type}`);
  }
  return block.quote?.rich_text || [];
}

export function getCodeProperties(block: SpecificBlockObject): { language: string; rich_text: RichTextArray } {
  if (!isCodeBlock(block)) {
    throw new Error(`Block is not a code block: ${block.type}`);
  }
  return {
    language: block.code?.language || '',
    rich_text: block.code?.rich_text || [],
  };
}

export function getImageProperties(block: SpecificBlockObject): {
  type: string;
  external?: { url: string };
  file?: { url: string };
  caption: RichTextArray;
} {
  if (!isImageBlock(block)) {
    throw new Error(`Block is not an image block: ${block.type}`);
  }
  const imageContent = block.image;
  return {
    type: imageContent.type,
    external: imageContent.type === 'external' ? imageContent.external : undefined,
    file: imageContent.type === 'file' ? imageContent.file : undefined,
    caption: imageContent.caption || [],
  };
}

export function getBulletedListItemRichText(block: SpecificBlockObject): RichTextArray {
  if (!isBulletedListItemBlock(block)) {
    throw new Error(`Block is not a bulleted list item block: ${block.type}`);
  }
  return block.bulleted_list_item?.rich_text || [];
}

export function getNumberedListItemRichText(block: SpecificBlockObject): RichTextArray {
  if (!isNumberedListItemBlock(block)) {
    throw new Error(`Block is not a numbered list item block: ${block.type}`);
  }
  return block.numbered_list_item?.rich_text || [];
}

export function getEquationExpression(block: SpecificBlockObject): string {
  if (!isEquationBlock(block)) {
    throw new Error(`Block is not an equation block: ${block.type}`);
  }
  return block.equation?.expression || '';
}

export function getCalloutRichText(block: SpecificBlockObject): RichTextArray {
  if (!isCalloutBlock(block)) {
    throw new Error(`Block is not a callout block: ${block.type}`);
  }
  return block.callout?.rich_text || [];
}

export function getTableProperties(block: SpecificBlockObject): {
  table_width: number;
  has_column_header: boolean;
  has_row_header: boolean;
} {
  if (!isTableBlock(block)) {
    throw new Error(`Block is not a table block: ${block.type}`);
  }
  return {
    table_width: block.table?.table_width || 0,
    has_column_header: block.table?.has_column_header || false,
    has_row_header: block.table?.has_row_header || false,
  };
}

export function getTableRowCells(block: SpecificBlockObject): RichTextArray[] {
  if (!isTableRowBlock(block)) {
    throw new Error(`Block is not a table row block: ${block.type}`);
  }
  return block.table_row?.cells || [];
}
