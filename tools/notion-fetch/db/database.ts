import { Client } from '@notionhq/client';
import pLimit from 'p-limit';
import { NotionPageCache } from './cache';
import type { BlogPageObject, PageContent, PageObject } from './notion-types';
import { fetchChildBlocks, queryAllPages } from './query';

const limit = pLimit(2);

const enum DatabaseId {
  BlogPosts = 'b47a04005a1541dfbf4a548ee42d04ab',
}

abstract class NotionDatabaseAdapter<PageObject> {
  protected readonly notion: Client;
  protected readonly cacheDir: string;

  constructor(authToken: string, cacheDir: string) {
    this.notion = new Client({ auth: authToken });
    this.cacheDir = cacheDir;
  }

  abstract queryPages(): Promise<PageObject[]>;
  abstract getPageContent(page: PageObject & { changed: boolean }): Promise<PageContent>;
  abstract updateCacheManifest(pages: PageObject[]): Promise<void>;
}

export class BlogPostDatabase extends NotionDatabaseAdapter<BlogPageObject> {
  private readonly databaseId = DatabaseId.BlogPosts;
  private readonly cache = new NotionPageCache(this.cacheDir, 'blog-posts');

  override async queryPages() {
    const pages = await queryAllPages<BlogPageObject>(this.notion, this.databaseId, {
      and: [
        { property: 'published', checkbox: { equals: true } },
        { property: 'title', title: { is_not_empty: true } },
        { property: 'distribution', multi_select: { contains: 'blog.lacolaco.net' } },
      ],
    });
    const manifest = await this.cache.readManifest();
    return pages.map((page) => {
      return { ...page, changed: manifest[page.id] !== page.last_edited_time };
    });
  }

  override async getPageContent(page: BlogPageObject & { changed: boolean }): Promise<PageContent> {
    if (page.changed) {
      const content = await this.fetchPageContent(page);
      await this.cache.savePageContent(page, content);
      return content;
    } else {
      return await this.cache.getPageContent(page);
    }
  }

  override async updateCacheManifest(pages: PageObject[]): Promise<void> {
    const manifest = await this.cache.readManifest();
    for (const page of pages) {
      manifest[page.id] = page.last_edited_time;
    }
    await this.cache.writeManifest(manifest);
  }

  private async fetchPageContent(page: BlogPageObject): Promise<PageContent> {
    return limit(() => fetchChildBlocks(this.notion, page.id));
  }
}

export class ZennPostDatabase extends NotionDatabaseAdapter<BlogPageObject> {
  private readonly databaseId = DatabaseId.BlogPosts;
  private readonly cache = new NotionPageCache(this.cacheDir, 'zenn-posts');

  override async queryPages() {
    const pages = await queryAllPages<BlogPageObject>(this.notion, this.databaseId, {
      and: [
        { property: 'published', checkbox: { equals: true } },
        { property: 'title', title: { is_not_empty: true } },
        { property: 'distribution', multi_select: { contains: 'zenn' } },
      ],
    });
    const manifest = await this.cache.readManifest();
    return pages.map((page) => {
      return { ...page, changed: manifest[page.id] !== page.last_edited_time };
    });
  }

  override async getPageContent(page: BlogPageObject & { changed: boolean }): Promise<PageContent> {
    if (page.changed) {
      const content = await this.fetchPageContent(page);
      await this.cache.savePageContent(page, content);
      return content;
    } else {
      return await this.cache.getPageContent(page);
    }
  }

  override async updateCacheManifest(pages: PageObject[]): Promise<void> {
    const manifest = await this.cache.readManifest();
    for (const page of pages) {
      manifest[page.id] = page.last_edited_time;
    }
    await this.cache.writeManifest(manifest);
  }

  private async fetchPageContent(page: BlogPageObject): Promise<PageContent> {
    return limit(() => fetchChildBlocks(this.notion, page.id));
  }
}
