import 'dotenv/config';

import { parseArgs } from 'node:util';
import { FileSystem } from './file-system';
import { NotionDatabase } from './notion';
import { renderPosts } from './renderer';

if (process.env.NOTION_AUTH_TOKEN == null) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}

const imagesDir = new URL('../../public/images', import.meta.url).pathname;
const postsDir = new URL('../../src/content/blog', import.meta.url).pathname;

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
