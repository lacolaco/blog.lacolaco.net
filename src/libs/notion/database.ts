import { Client } from '@notionhq/client';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import pLimit from 'p-limit';
import { PostData } from '../post/schema';
import { getPostJSONFileName } from '../post/slug';
import type { BlogDatabaseProperties, BlogPageObject, PageObjectWithContent } from './types';
import { fetchChildBlocks, fetchDatabaseProperties, getLocale, getSlug, queryAllPages } from './utils';

const postCollectionDir = new URL('../../content/post', import.meta.url).pathname;

const limit = pLimit(2);

export class NotionDatabase {
  private notion = new Client({ auth: this.authToken });

  constructor(
    private authToken: string,
    private databaseID: string,
  ) {}

  async queryBlogPages(): Promise<BlogPageObject[]> {
    const pages = await queryAllPages(this.notion, this.databaseID, {
      and: [
        { property: 'published', checkbox: { equals: true } },
        { property: 'title', title: { is_not_empty: true } },
        {
          property: 'distribution',
          multi_select: { contains: 'blog.lacolaco.net' },
        },
      ],
    });
    return pages.map((page) => {
      const slug = getSlug(page);
      const locale = getLocale(page);
      return { ...page, slug, locale } as BlogPageObject;
    });
  }

  async isCached(page: BlogPageObject): Promise<boolean> {
    const filepath = path.resolve(postCollectionDir, getPostJSONFileName(page.slug, page.locale ?? 'ja'));
    const data = await readFile(filepath, 'utf-8')
      .then((s) => JSON.parse(s) as PostData)
      .catch(() => null);
    if (!data) {
      return false;
    }
    const lastEditedTime = page.last_edited_time;
    const lastEditedTimeInCache = data.lastEditedAt;
    return lastEditedTime === lastEditedTimeInCache;
  }

  async getPageContents(page: BlogPageObject): Promise<PageObjectWithContent> {
    const content = await limit(async () => {
      return fetchChildBlocks(this.notion, page.id).catch((e) => {
        console.error(`Failed to fetch content of ${page.url}`, e);
        return [];
      });
    });
    return {
      ...page,
      content,
    };
  }

  async getDatabaseProperties(): Promise<BlogDatabaseProperties> {
    const properties = await fetchDatabaseProperties(this.notion, this.databaseID);
    return properties as BlogDatabaseProperties;
  }
}
