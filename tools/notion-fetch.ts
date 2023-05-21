import 'dotenv/config';

import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { NotionDatabase } from './lib/notion';
import { renderPosts } from './lib/renderer';
import { FileSystem } from './lib/file-system';

if (process.env.NOTION_AUTH_TOKEN == null) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const imagesDir = path.resolve(__dirname, '../public/images');
const postsDir = path.resolve(__dirname, '../src/content/blog');

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
  const db = new NotionDatabase();
  const imagesFS = new FileSystem(imagesDir, { dryRun });
  const postsFS = new FileSystem(postsDir, { dryRun });
  // collect posts from notion
  const pages = await db.queryBlogPages();
  if (pages.length > 0) {
    // convert page content to post markdown
    const posts = await renderPosts(pages, imagesFS);
    // write posts to file
    await Promise.all(posts.map((post) => postsFS.save(post.filename, post.content, { encoding: 'utf-8' })));
  }
  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
