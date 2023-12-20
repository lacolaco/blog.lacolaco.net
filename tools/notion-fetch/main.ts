import { NotionDatabase } from '@lib/notion';
import { getPostJSONFileName } from '@lib/post';
import { SingleBar } from 'cli-progress';
import { parseArgs } from 'node:util';
import { toBlogPostJSON, toTagsJSON } from './content';
import { FileSystem } from './file-system';
import { formatJSON } from './utils/format';

const { NOTION_AUTH_TOKEN, NOTION_DATABASE_ID } = process.env;
if (NOTION_AUTH_TOKEN == null) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}

const imagesDir = new URL('../../public/images', import.meta.url).pathname;
const pageCacheDir = new URL('../../.cache/page', import.meta.url).pathname;
const postJsonDir = new URL('../../src/content/post', import.meta.url).pathname;
const tagsJsonDir = new URL('../../src/content/tags', import.meta.url).pathname;

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
    debug: {
      type: 'boolean',
    },
  },
});
const { force = false, 'dry-run': dryRun = false, debug = false } = values;

async function main() {
  const db = new NotionDatabase(NOTION_AUTH_TOKEN, NOTION_DATABASE_ID);
  const imagesFS = new FileSystem(imagesDir, { dryRun });
  const postJsonFS = new FileSystem(postJsonDir, { dryRun });
  const pageCacheFS = new FileSystem(pageCacheDir, { dryRun });
  const tagsJsonFS = new FileSystem(tagsJsonDir, { dryRun });

  console.log('Fetching database properties...');
  const properties = await db.getDatabaseProperties();
  console.log("Updating 'tags.json'...");
  const tagsJson = await formatJSON(toTagsJSON(properties.tags));
  await tagsJsonFS.save('tags.json', tagsJson, { encoding: 'utf-8' });

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
        if (debug) {
          await pageCacheFS.save(`${page.id}.json`, JSON.stringify(pageWithContent, null, 2), { encoding: 'utf-8' });
        }
        imagesFS.remove(pageWithContent.slug);
        const post = await toBlogPostJSON(pageWithContent, imagesFS);
        const formatted = await formatJSON(post);
        const filepath = getPostJSONFileName(pageWithContent.slug, pageWithContent.locale ?? 'ja');
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
