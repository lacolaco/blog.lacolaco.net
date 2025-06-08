import { BlogDatabase } from '@lacolaco/notion-db';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { FileSystem } from './filesystem';
import { extractFrontmatter, transformNotionPageToMarkdown } from './page-transformer';
import { formatJSON, parseFrontmatter, shouldSkipProcessing, toCategoriesJSON, toTagsJSON } from './utils';

const { NOTION_AUTH_TOKEN } = process.env;
if (!NOTION_AUTH_TOKEN) {
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

  if (debug) {
    // Create a temporary directory for debugging
    await mkdir(`${rootDir}.tmp`, { recursive: true });
  }

  await Promise.all(
    pages.map(async (page) => {
      // まずスラッグだけを軽量に取得
      const { slug } = extractFrontmatter(page);
      const filename = `${slug}.md`;

      // 既存のMarkdownファイルをチェック
      const existingMarkdown = await filesystems.posts.load(filename);
      if (existingMarkdown) {
        const frontmatter = parseFrontmatter(existingMarkdown.toString('utf-8'));
        if (shouldSkipProcessing(page.last_edited_time, frontmatter)) {
          console.log(`Skipping ${filename} (no changes)`);
          return;
        }
      }

      // 必要な場合のみ完全な変換を実行
      const { markdown, imageDownloads } = await transformNotionPageToMarkdown(page);

      if (debug) {
        // Write the raw page data to a file into .tmp directory for debugging
        await writeFile(`${rootDir}.tmp/${slug}.json`, await formatJSON(page), { encoding: 'utf-8' });
      }

      await downloadImages(imageDownloads, filesystems.images, slug);
      await filesystems.posts.save(filename, markdown, { encoding: 'utf-8' });
    }),
  );

  console.log('Done');
}

async function downloadImages(
  imageDownloads: Array<{ filename: string; url: string }>,
  filesystem: FileSystem,
  slug: string,
): Promise<void> {
  if (imageDownloads.length === 0) {
    return;
  }

  // Clean up the slug directory before downloading
  await filesystem.remove(slug);

  console.log(`Downloading ${imageDownloads.length} images...`);

  await Promise.all(
    imageDownloads.map(async ({ filename, url }) => {
      try {
        console.log(`Downloading ${filename} from ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        await filesystem.save(`${slug}/${filename}`, new Uint8Array(buffer));

        console.log(`Downloaded ${filename} to ${slug}/${filename}`);
      } catch (error) {
        console.error(`Failed to download ${filename}:`, error);
        throw error;
      }
    }),
  );

  console.log(`Downloaded ${imageDownloads.length} images`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
