import { NotionDatabase } from '@lib/notion';
import { SingleBar } from 'cli-progress';
import { parseArgs } from 'node:util';
import { toBlogPostJSON } from './content';
import { FileSystem } from './file-system';
import { formatJSON } from './utils/format';

const { NOTION_AUTH_TOKEN, NOTION_DATABASE_ID } = process.env;
if (NOTION_AUTH_TOKEN == null) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}

const imagesDir = new URL('../../public/images', import.meta.url).pathname;
const postJsonDir = new URL('../../src/content/post', import.meta.url).pathname;

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    force: {
      type: 'boolean',
      short: 'f',
    },
    'dry-run': {
      type: 'boolean',
      short: 'D',
    },
  },
});
const { force = false, 'dry-run': dryRun = false } = values;

async function main() {
  const db = new NotionDatabase(NOTION_AUTH_TOKEN, NOTION_DATABASE_ID);
  const imagesFS = new FileSystem(imagesDir, { dryRun });
  const postJsonFS = new FileSystem(postJsonDir, { dryRun });

  console.log('Fetching pages...');
  const pages = await db.queryBlogPages();
  console.log(`Fetched ${pages.length} pages`);

  const pagesToUpdate = await Promise.all(
    pages.map(async (page) => {
      const isCached = await db.isCached(page);
      return { page, isCached };
    }),
  ).then((arr) => arr.filter(({ isCached }) => !isCached).map(({ page }) => page));

  if (pagesToUpdate.length === 0) {
    console.log('No pages to update');
  } else {
    console.log(`Updating ${pagesToUpdate.length} pages...`);

    const progress = new SingleBar({});
    progress.start(pagesToUpdate.length, 0);
    await Promise.all(
      pagesToUpdate.map(async (page) => {
        const pageWithContent = await db.getPageContents(page);
        const post = await toBlogPostJSON(pageWithContent, imagesFS);
        const formatted = await formatJSON(post);
        const filepath = (post.locale ?? 'ja') === 'ja' ? `${post.slug}.json` : `${post.slug}.${post.locale}.json`;
        await postJsonFS.save(filepath, formatted, { encoding: 'utf-8' });

        progress.increment();
        return pageWithContent;
      }),
    );
    progress.stop();
  }
  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
