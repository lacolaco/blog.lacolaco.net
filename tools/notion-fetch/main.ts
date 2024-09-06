import { BlogDatabase } from '@lacolaco/notion-fetch';
import { getLocale, getSlug } from '@lib/notion';
import { getPostJSONFileName } from '@lib/post';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { toBlogPostJSON, toCategoriesJSON, toTagsJSON } from './content';
import { FileSystem } from './file-system';
import { formatJSON } from './utils/format';

const { NOTION_AUTH_TOKEN } = process.env;
if (NOTION_AUTH_TOKEN == null) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}

const rootDir = new URL('../..', import.meta.url).pathname;

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
  const db = new BlogDatabase(NOTION_AUTH_TOKEN);
  const imagesFS = new FileSystem(rootDir, 'public/images', { dryRun });
  const postJsonFS = new FileSystem(rootDir, 'src/content/post', { dryRun });
  const tagsJsonFS = new FileSystem(rootDir, 'src/content/tags', { dryRun });
  const categoriesJsonFS = new FileSystem(rootDir, 'src/content/categories', { dryRun });

  console.log('Fetching database properties...');
  const properties = await db.getDatabaseProperties();
  console.log("Updating 'tags.json'...");
  const tagsJson = await formatJSON(toTagsJSON(properties.tags));
  await tagsJsonFS.save('tags.json', tagsJson, { encoding: 'utf-8' });

  console.log("Updating 'categories.json'...");
  const categoriesJson = await formatJSON(toCategoriesJSON(properties.category));
  await categoriesJsonFS.save('categories.json', categoriesJson, { encoding: 'utf-8' });

  console.log('Fetching pages...');

  const { lastNotionFetch } = await readManifest();
  const pages = await db.query('blog.lacolaco.net', { newerThan: new Date(lastNotionFetch) });
  console.log(`Fetched ${pages.length} pages`);

  if (pages.length === 0) {
    console.log('No pages to update');
  } else {
    console.log(`Updating ${pages.length} pages...`);
    await Promise.all(
      pages.map(async (page) => {
        const slug = getSlug(page);
        const locale = getLocale(page) ?? 'ja';
        imagesFS.remove(slug);
        const post = await toBlogPostJSON({ ...page, slug, locale }, imagesFS);
        const formatted = await formatJSON(post);
        const filepath = getPostJSONFileName(slug, locale);
        await postJsonFS.save(filepath, formatted, { encoding: 'utf-8' });
      }),
    );

    if (!dryRun) {
      await writeManifest({ lastNotionFetch: new Date().toISOString() });
    }
  }

  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function readManifest() {
  const file = await readFile(new URL('../../notion-fetch-manifest.json', import.meta.url), 'utf-8');
  return JSON.parse(file) as { lastNotionFetch: string };
}

async function writeManifest(manifest: { lastNotionFetch: string }) {
  await writeFile(new URL('../../notion-fetch-manifest.json', import.meta.url), JSON.stringify(manifest, null, 2));
}
