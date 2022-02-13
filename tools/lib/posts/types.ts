import { BlockObject, PageObject } from '../notion';

export type NotionPost = PageObject & { content: BlockObject[] };

export type Frontmatter = {
  title: string;
  createdAt: string;
  updatedAt: string | null;
  tags: string[];
  [key: string]: string | string[] | boolean | null;
};
