import { SingleBar } from 'cli-progress';
import { PageObjectWithContent, BlogPostDatabase } from './db';
import { findCacheDir } from './db/cache';

export async function fetchBlogPostPages(
  notionAuthToken: string,
  cacheDir: string | null,
  options: { force?: boolean; dryRun?: boolean } = {},
): Promise<(PageObjectWithContent & { changed: boolean })[]> {
  if (!cacheDir) {
    cacheDir = await findCacheDir('lacolaco-notion-db');
  }
  const db = new BlogPostDatabase(notionAuthToken, cacheDir);

  const progress = new SingleBar({});
  return db
    .queryPages()
    .then(async (pages) => {
      progress.start(pages.length, 0);
      return Promise.all(
        pages.map(async (page) => {
          if (options.force) {
            page.changed = true;
          }
          const content = await db.getPageContent(page).finally(() => {
            progress.increment();
          });
          return { ...page, content };
        }),
      );
    })
    .then(async (pages) => {
      await db.updateCacheManifest(pages);
      return pages;
    })
    .finally(() => {
      progress.stop();
    });
}
