import { BlogDatabase } from '@lacolaco/notion-db';
import { getLocale, getSlug } from '@lib/notion';
import { getPostJSONFileName } from '@lib/post';
import { parseArgs } from 'node:util';
import { toBlogPostJSON, toCategoriesJSON, toTagsJSON } from './content';
import { FileSystem } from './file-system';
import { formatJSON } from './utils';

const { NOTION_AUTH_TOKEN } = process.env;
if (NOTION_AUTH_TOKEN == null) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}

const rootDir = new URL('../..', import.meta.url).pathname;

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    force: { type: 'boolean', short: 'f' },
    'dry-run': { type: 'boolean', short: 'D' },
    debug: { type: 'boolean' },
  },
});
const { force = false, 'dry-run': dryRun = false, debug = false } = values;

async function main() {
  const db = new BlogDatabase(NOTION_AUTH_TOKEN);
  const filesystems = {
    images: new FileSystem(rootDir, 'public/images', { dryRun }),
    posts: new FileSystem(rootDir, 'src/content/post', { dryRun }),
    tags: new FileSystem(rootDir, 'src/content/tags', { dryRun }),
    categories: new FileSystem(rootDir, 'src/content/categories', { dryRun }),
  };

  console.log('Fetching database properties...');
  const properties = await db.getDatabaseProperties();

  console.log("Updating 'tags.json'...");
  await filesystems.tags.save('tags.json', await formatJSON(toTagsJSON(properties.tags)), { encoding: 'utf-8' });

  console.log("Updating 'categories.json'...");
  await filesystems.categories.save('categories.json', await formatJSON(toCategoriesJSON(properties.category)), {
    encoding: 'utf-8',
  });

  console.log('Fetching pages...');
  const pages = await db.query('blog.lacolaco.net', { dryRun });
  console.log(`Fetched ${pages.length} pages`);

  if (pages.length === 0) {
    console.log('No pages to update');
    return;
  }

  console.log(`Updating ${pages.length} pages...`);
  await Promise.all(
    pages.map(async (page) => {
      const slug = getSlug(page);
      const locale = getLocale(page) ?? 'ja';
      filesystems.images.remove(slug);
      const post = await toBlogPostJSON({ ...page, slug, locale }, filesystems.images);
      const filepath = getPostJSONFileName(slug, locale);
      await filesystems.posts.save(filepath, await formatJSON(post), { encoding: 'utf-8' });
    }),
  );

  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
