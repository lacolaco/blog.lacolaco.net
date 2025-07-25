import { BlogDatabase } from '@lacolaco/notion-db';
import type { PostFrontmatterOut } from '@lib/post';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { format as formatDate } from 'date-fns';
import { newTransformContext } from './block-transformer';
import { FileSystem } from './filesystem';
import { parseFrontmatter } from './frontmatter';
import { downloadImages } from './image-downloader';
import { buildMarkdownFile, extractFrontmatter, generateContent } from './page-transformer';
import { formatJSON, shouldSkipProcessing, toCategoriesJSON, toTagsJSON } from './utils';

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
  const pages = await db.query2('blog.lacolaco.net', { draft, dryRun });
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
      const frontmatter = extractFrontmatter(page);
      const filename = `${formatDate(frontmatter.created_time, 'yyyy/MM')}/${frontmatter.slug}.md`;

      // 既存のMarkdownファイルをチェック
      const existingMarkdown = await filesystems.posts.load(filename);
      if (existingMarkdown) {
        const markdownFrontmatter = parseFrontmatter<PostFrontmatterOut>(existingMarkdown.toString('utf-8'));
        if (shouldSkipProcessing(page.last_edited_time, markdownFrontmatter)) {
          console.log(`Skipping ${filename} (no changes)`);
          return;
        }
      }

      // 必要な場合のみ完全な変換を実行
      const context = newTransformContext(frontmatter.slug);
      const childBlocks = await page.fetchChildren();
      if (debug) {
        // Write the raw page data to a file into .tmp directory for debugging
        await writeFile(
          `${rootDir}.tmp/${frontmatter.slug}.json`,
          await formatJSON({ ...page, children: childBlocks }),
          {
            encoding: 'utf-8',
          },
        );
      }
      const content = generateContent(childBlocks, context);
      const markdown = await buildMarkdownFile(frontmatter, content, context);
      const imageDownloads = context.imageDownloads;

      await downloadImages(imageDownloads, filesystems.images, frontmatter.slug);
      await filesystems.posts.save(filename, markdown, { encoding: 'utf-8' });
      // もし古いJSONファイルが存在する場合は削除
      const oldJsonFile = `${frontmatter.slug}.json`;
      await filesystems.posts.remove(oldJsonFile);
    }),
  );

  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
