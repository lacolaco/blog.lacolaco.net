/**
 * ブログ記事のフロントマター型定義
 */
export interface BlogPostFrontmatter extends Record<string, unknown> {
  title: string;
  slug: string;
  icon: string;
  created_time: string;
  last_edited_time: string;
  category: string;
  tags: string[];
  published: boolean;
  notion_url: string;
  locale?: string;
  canonical_url?: string;
  features?: {
    tweet?: boolean;
  };
}
