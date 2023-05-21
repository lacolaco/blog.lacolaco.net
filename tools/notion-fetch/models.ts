import type { BlockObject } from './notion';

export type BlogPostObject = {
  readonly slug: string;
  readonly title: string;
  readonly date: string;
  readonly tags: string[];

  readonly content: BlockObject[];
};
