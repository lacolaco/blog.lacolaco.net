import { BlockObject, PageObject } from '../notion';

export type NotionPost = PageObject & { content: BlockObject[] };

export type Frontmatter = {
  title: string;
  createdAt: string;
  updatedAt: string | null;
  tags: string[];
  [key: string]: string | string[] | boolean | null;
};

export interface NodeRenderer<T> {
  render(node: T): string | null;
}
