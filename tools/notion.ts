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
  .option('-D, --dry-run', 'dry run', false)
  .action(async (options: { force: boolean; dryRun: boolean }) => {
    const remotePostsRepo = new RemotePostsRepository(notion);
    const localPostsRepo = new LocalPostsRepository(postsDir, { dryRun: options.dryRun });
    const imagesRepo = new ImagesRepository(imagesDir, { dryRun: options.dryRun });
    const renderer = new LocalPostRenderer(localPostsRepo, imagesRepo, { forceUpdate: options.force });

    // collect posts from notion
    const posts = await remotePostsRepo.query();
    // write posts to file
    await renderer.renderPosts(posts);
  });

program.parse(process.argv);
