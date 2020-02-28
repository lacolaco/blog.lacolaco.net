import * as fse from 'fs-extra';
import * as path from 'path';
import { Esa } from './esa/client';
import { PostWithFrontmatter } from './types';

async function fetchEsaPosts(): Promise<PostWithFrontmatter[]> {
  const client = new Esa(
    'lacolaco',
    'JSyW5sir9Q3oTPxtNCaxlXUO5UfXsvWdz44Q11hGLw0'
  );
  const query = `in:"Blog" wip:false`;
  const sort = 'created';
  let resp = await client.posts(query, sort, { per_page: 100, page: 1 });
  let posts = [...resp.posts];
  while (resp.next_page != null) {
    resp = await client.posts(query, sort, {
      per_page: 100,
      page: resp.next_page
    });
    posts = [...posts, ...resp.posts];
  }
  return posts.map(post => ({
    title: post.name,
    slug: slugify(post.category.replace('Blog/', '')),
    date: post.updated_at,
    tags: post.tags,
    body: post.body_md
  }));
}

function slugify(base: string): string {
  return base.replace(/\//g, '-').replace(/\s/g, '-');
}

function createFrontmatter(post: PostWithFrontmatter): string {
  return `
---
title: "${post.title}"
date: ${post.date}
tags: [${post.tags.map(tag => `"${tag}"`).join(',')}]
foreign: true
---
`.trim();
}

async function fetchRemotePosts() {
  return [...(await fetchEsaPosts())];
}

fetchRemotePosts().then(posts => {
  for (const post of posts) {
    const outputPath = path.resolve(
      __dirname,
      '../content/post',
      `${post.slug}.md`
    );
    const content = [createFrontmatter(post), post.body].join('\n\n');

    fse.writeFileSync(outputPath, content, {
      encoding: 'utf-8'
    });
  }
});
