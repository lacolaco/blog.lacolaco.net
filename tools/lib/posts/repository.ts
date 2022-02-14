import * as fs from 'fs/promises';
import * as path from 'path';
import { request } from 'undici';
import { NotionAPI } from '../notion';
import { NotionPost } from './types';

const postsDatabaseId = 'b47a04005a1541dfbf4a548ee42d04ab';

export class RemotePostsRepository {
  constructor(private readonly notion: NotionAPI) {}

  async query(): Promise<Array<NotionPost>> {
    // collect pages
    const pages = await this.notion.queryAllPages(postsDatabaseId);

    // convert pages to post items
    const pagesWithContent = await Promise.all(
      pages.map(async (page) => {
        const blocks = await this.notion.fetchChildBlocks(page.id);
        return { ...page, content: blocks };
      }),
    );
    return pagesWithContent;
  }
}

export class LocalPostsRepository {
  constructor(private readonly postsDir: string) {}

  async savePost(slug: string, content: string) {
    const filePath = path.resolve(this.postsDir, `${slug}.md`);
    await fs.writeFile(filePath, content, { encoding: 'utf8' });
  }

  async loadPost(slug: string): Promise<string | null> {
    const filePath = path.resolve(this.postsDir, `${slug}.md`);
    try {
      return await fs.readFile(filePath, { encoding: 'utf8' });
    } catch (e) {
      return null;
    }
  }
}

export class ImagesRepository {
  constructor(private readonly imagesDir: string) {}

  async clearPostImages(slug: string) {
    const dir = path.resolve(this.imagesDir, slug);
    await fs.rm(dir, { recursive: true });
  }

  async download(slug: string, imageUrl: string): Promise<string | null> {
    console.log(`[ImagesRepository] downloading ${imageUrl}`);
    const url = new URL(imageUrl);
    const resp = await request(url);
    const [, filename] = decodeURIComponent(url.pathname).match(/^\/secure\.notion-static\.com\/(.*)/) ?? [];
    if (filename == null) {
      console.warn(`[ImagesRepository] unsupported url format: ${imageUrl}`);
      return null;
    }
    const relPath = `${slug}/${filename}`;
    const absPath = path.resolve(this.imagesDir, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, resp.body);
    console.log(`[ImagesRepository] downloaded ${absPath}`);
    return relPath;
  }
}
