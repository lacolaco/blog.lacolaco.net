/**
 * notion-fetchツール専用のNotionブロック型定義
 * @notionhq/clientの型定義を最大限活用
 */

import type {
  BlockObjectResponse,
  PageObjectResponse,
  RichTextItemResponse,
  BulletedListItemBlockObjectResponse,
  NumberedListItemBlockObjectResponse,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

export type DatabasePropertyConfigs = DatabaseObjectResponse['properties'];
export type DatabasePropertyConfig<T extends string> = DatabasePropertyConfigs[string] & { type: T };

export type BlogDatabaseProperties = DatabasePropertyConfigs & {
  title: DatabasePropertyConfig<'title'>;
  slug: DatabasePropertyConfig<'rich_text'>;
  locale: DatabasePropertyConfig<'select'>;
  category: DatabasePropertyConfig<'select'>;
  tags: DatabasePropertyConfig<'multi_select'>;
  published: DatabasePropertyConfig<'checkbox'>;
  canonical_url: DatabasePropertyConfig<'url'>;
  created_at_override: DatabasePropertyConfig<'date'>;
  updated_at: DatabasePropertyConfig<'date'>;
};

export type PageObject = PageObjectResponse;

// @notionhq/clientの型定義を直接使用
export type RichTextItemObject = RichTextItemResponse;
export type RichTextArray = RichTextItemObject[];

// ベースとなる型なしブロックオブジェクト
export type UntypedBlockObject = BlockObjectResponse & {
  children?: UntypedBlockObject[];
};

// 各ブロックタイプの個別型定義（@notionhq/client の型を最大限活用）
export type BulletedListItemBlockObject = BulletedListItemBlockObjectResponse;
export type NumberedListItemBlockObject = NumberedListItemBlockObjectResponse;

// すべてのブロックタイプのユニオン型
export type SpecificBlockObject = BlockObjectResponse;

// 特定のプロパティタイプ（型安全性のため）
export type SelectProperty = Extract<PageObjectResponse['properties'][string], { type: 'select' }>;

// 型ガード関数
export function isListBlock(
  block: UntypedBlockObject,
): block is BulletedListItemBlockObject | NumberedListItemBlockObject {
  return block.type === 'bulleted_list_item' || block.type === 'numbered_list_item';
}
