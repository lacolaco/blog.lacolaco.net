import { NotionDatabase, getLocale, getSlug } from '@lib/notion';
import { getPostJSONFileName } from '@lib/post';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { toBlogPostJSON, toCategoriesJSON, toTagsJSON } from './content';
import { fetchBlogPostPages } from './fetch';
import { FileSystem } from './file-system';
import { formatJSON } from './utils/format';

const { NOTION_AUTH_TOKEN, NOTION_DATABASE_ID } = process.env;
if (NOTION_AUTH_TOKEN == null) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}

const rootDir = new URL('../..', import.meta.url).pathname;
const cacheDir = resolve(rootDir, 'notion-db-cache');

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
  const imagesFS = new FileSystem(rootDir, 'public/images', { dryRun });
  const postJsonFS = new FileSystem(rootDir, 'src/content/post', { dryRun });
  const tagsJsonFS = new FileSystem(rootDir, 'src/content/tags', { dryRun });
  const categoriesJsonFS = new FileSystem(rootDir, 'src/content/categories', { dryRun });

  // prepare directories
  await mkdir(cacheDir, { recursive: true });

  console.log('Fetching database properties...');
  const properties = await db.getDatabaseProperties();
  console.log("Updating 'tags.json'...");
  const tagsJson = await formatJSON(toTagsJSON(properties.tags));
  await tagsJsonFS.save('tags.json', tagsJson, { encoding: 'utf-8' });

  console.log("Updating 'categories.json'...");
  const categoriesJson = await formatJSON(toCategoriesJSON(properties.category));
  await categoriesJsonFS.save('categories.json', categoriesJson, { encoding: 'utf-8' });

  console.log('Fetching pages...');
  const pages = await fetchBlogPostPages(NOTION_AUTH_TOKEN, cacheDir, { force, dryRun });
  console.log(`Fetched ${pages.length} pages`);

  const pagesToUpdate = pages.filter((page) => force || page.changed);

  if (pagesToUpdate.length === 0) {
    console.log('No pages to update');
  } else {
    console.log(`Updating ${pagesToUpdate.length} pages...`);
    await Promise.all(
      pagesToUpdate.map(async (page) => {
        const slug = getSlug(page);
        const locale = getLocale(page) ?? 'ja';
        imagesFS.remove(slug);
        const post = await toBlogPostJSON({ ...page, slug, locale }, imagesFS);
        const formatted = await formatJSON(post);
        const filepath = getPostJSONFileName(slug, locale);
        await postJsonFS.save(filepath, formatted, { encoding: 'utf-8' });
      }),
    );
  }
  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
