import 'dotenv/config';

import { Command } from 'commander';
import * as path from 'path';
import { ImagesRepository, LocalPostsRepository, RemotePostsRepository } from './lib/posts/repository';
import { Client } from '@notionhq/client';
import { NotionAPI } from './lib/notion';
import { LocalPostRenderer } from './lib/posts/renderer';

if (process.env.NOTION_AUTH_TOKEN == null) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}
const notion = new NotionAPI(new Client({ auth: process.env.NOTION_AUTH_TOKEN }));
const postsDir = path.resolve(__dirname, '../content/post');
const imagesDir = path.resolve(__dirname, '../static/img');

const program = new Command();

program
  .command('fetch')
  .option('-f, --force', 'force update', false)
  .action(async (options: { force: boolean }) => {
    const remotePostsRepo = new RemotePostsRepository(notion);
    const localPostsRepo = new LocalPostsRepository(postsDir);
    const imagesRepo = new ImagesRepository(imagesDir);
    const renderer = new LocalPostRenderer(localPostsRepo, imagesRepo);

    // collect posts from notion
    const posts = await remotePostsRepo.query();
    // write posts to file
    await renderer.renderPosts(posts, { forceUpdate: options.force });
  });

program.parse(process.argv);
