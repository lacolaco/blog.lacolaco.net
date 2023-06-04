import type { Client } from '@notionhq/client';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

type ElementType<T> = T extends (infer U)[] ? U : never;

type MatchType<T, U, V = never> = T extends U ? T : V;

export type DatabaseQueryParams = Parameters<Client['databases']['query']>[0];
export type QueryFilterObject = DatabaseQueryParams['filter'];

export type PageObject = MatchType<
  ElementType<Awaited<ReturnType<Client['databases']['query']>>['results']>,
  {
    properties: unknown;
  }
>;

export type PageProperties = PageObject['properties'];
export type PageProperty<T extends string> = PageProperties[string] & { type: T };

export type BlogPageProperties = PageProperties & {
  title: PageProperty<'title'>;
  slug: PageProperty<'rich_text'>;
  tags: PageProperty<'multi_select'>;
  published: PageProperty<'checkbox'>;
  canonical_url: PageProperty<'url'>;
  created_at_override: PageProperty<'date'>;
  updated_at: PageProperty<'date'>;
};

export type BlockObjectType = BlockObjectResponse['type'] | unknown;

export type BlockObject<T extends BlockObjectType = unknown> = BlockObjectResponse & {
  type: T;
  children?: BlockObject[];
};

export type PageObjectWithContent = PageObject & {
  properties: BlogPageProperties;
  slug: string;
  content: BlockObject[];
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
