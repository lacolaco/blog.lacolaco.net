import * as fs from 'fs/promises';
import * as path from 'path';
import * as stream from 'stream';
import { Observable, of, switchMap } from 'rxjs';
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
  constructor(private readonly postsDir: string, private readonly options: { dryRun?: boolean } = {}) {}

  async savePost(slug: string, content: string) {
    if (this.options.dryRun) {
      return;
    }
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
  constructor(private readonly imagesDir: string, private readonly options: { dryRun?: boolean } = {}) {}

  async clearPostImages(slug: string) {
    if (this.options.dryRun) {
      return;
    }
    const dir = path.resolve(this.imagesDir, slug);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {}
  }

  async saveImage(localPath: string, data: stream.Readable): Promise<void> {
    const absPath = path.resolve(this.imagesDir, localPath);
    if (this.options.dryRun) {
      return;
    }
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, data);
  }

  download(imageUrl: string, localPath: string): Observable<void> {
    console.log(`[ImagesRepository] downloading ${localPath}`);

    return of(new URL(imageUrl)).pipe(
      switchMap((url) => request(url)),
      switchMap((response) => this.saveImage(localPath, response.body)),
    );
  }
}
