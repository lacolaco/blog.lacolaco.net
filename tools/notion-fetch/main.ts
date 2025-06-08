import { BlogDatabase } from '@lacolaco/notion-db';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { toCategoriesJSON, toTagsJSON } from './content';
import { FileSystem } from './file-system';
import { transformNotionPageToMarkdown } from './notion2md/page-transformer';
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
    draft: { type: 'boolean', short: 'd', default: false },
    force: { type: 'boolean', short: 'f' },
    'dry-run': { type: 'boolean', short: 'D' },
    debug: { type: 'boolean', default: false },
  },
});
const { draft, 'dry-run': dryRun = false, debug } = values;
console.log(`Running with options: draft=${draft}, dryRun=${dryRun}`);

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
  const pages = await db.query('blog.lacolaco.net', { draft, dryRun });
  console.log(`Fetched ${pages.length} pages`);

  if (pages.length === 0) {
    console.log('No pages to update');
    return;
  }

  console.log(`Updating ${pages.length} pages...`);
  if (debug) {
    // Create a temporary directory for debugging
    await mkdir(`${rootDir}.tmp`, { recursive: true });
  }
  await Promise.all(
    pages.map(async (page) => {
      const { filename, markdown } = await transformNotionPageToMarkdown(page);
      if (debug) {
        // Write the raw page data to a file into .tmp directory for debugging
        await writeFile(`${rootDir}.tmp/${filename}.json`, await formatJSON(page), { encoding: 'utf-8' });
      }
      // await filesystems.images.remove(slug);

      await filesystems.posts.save(filename, markdown, { encoding: 'utf-8' });
    }),
  );

  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
