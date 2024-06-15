import type { Client } from '@notionhq/client';
import type {
  BlockObjectResponse,
  PageObjectResponse,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

export type DatabaseQueryParams = Parameters<Client['databases']['query']>[0];
export type QueryFilterObject = DatabaseQueryParams['filter'];

export type PageObject = PageObjectResponse;

export type DatabasePropertyConfigs = DatabaseObjectResponse['properties'];
export type DatabasePropertyConfig<T extends string> = DatabasePropertyConfigs[string] & { type: T };

export type BlogPostLocale = 'ja' | 'en';

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

export type PageProperties = PageObject['properties'];
export type PageProperty<T extends string> = PageProperties[string] & { type: T };

export type BlogPageProperties = PageProperties & {
  title: PageProperty<'title'>;
  slug: PageProperty<'rich_text'>;
  locale: PageProperty<'select'>;
  category: PageProperty<'select'>;
  tags: PageProperty<'multi_select'>;
  published: PageProperty<'checkbox'>;
  canonical_url: PageProperty<'url'>;
  created_at_override: PageProperty<'date'>;
  updated_at: PageProperty<'date'>;
};

export type BlogPageObject = PageObject & {
  properties: BlogPageProperties;
};

export type BlockObjectType = BlockObjectResponse['type'] | unknown;

export type BlockObject<T extends BlockObjectType = unknown> = BlockObjectResponse & {
  type: T;
  children?: BlockObject[];
};

export type PageContent = BlockObject[];

export type PageObjectWithContent = PageObject & {
  properties: BlogPageProperties;
  content: PageContent;
};

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

export type RichTextNode = TextNode | MentionNode | EquationNode;

export type RichTextArray = Array<RichTextNode>;
