import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import rehypeGithubAlert from 'rehype-github-alert';
import rehypeGithubEmoji from 'rehype-github-emoji';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import remarkEmbed from './tools/remark-embed';
import rehypeImageCdn from './tools/rehype-image-cdn';
import rehypeExtractMediaHtml from './tools/rehype-extract-media-html';

import node from '@astrojs/node';
import type { AstroIntegration } from 'astro';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// prerender された検索 DB (dist/client/search-db.bin) を dist/server/search.db へ移す。
// dist/client は静的配信されるため、DB を公開 URL に残さない。dist/server は Docker イメージの dist に含まれる。
const moveSearchDb = (): AstroIntegration => ({
  name: 'move-search-db',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const from = fileURLToPath(new URL('search-db.bin', dir));
      const to = fileURLToPath(new URL('../server/search.db', dir));
      if (!existsSync(from)) throw new Error(`search-db.bin not found: ${from}`);
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
    },
  },
});

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.lacolaco.net',
  outDir: 'dist',
  integrations: [sitemap(), react(), moveSearchDb()],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // https://github.com/withastro/astro/issues/12824#issuecomment-2563095382
      // Use react-dom/server.edge instead of react-dom/server.browser for React 19.
      // Without this, MessageChannel from node:worker_threads needs to be polyfilled.
      alias: import.meta.env.PROD
        ? {
            'react-dom/server': 'react-dom/server.edge',
          }
        : undefined,
    },
    optimizeDeps: {
      exclude: ['@resvg/resvg-js'],
    },
  },

  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
  },

  markdown: {
    gfm: true,
    remarkPlugins: [remarkBreaks, remarkMath, remarkEmbed],
    // rehypeExtractMediaHtml は notion-sync が出力する <video src="/videos/..."> と
    // 記事本文が使う <img src="/images/..."> を含む raw ノードのみを element 化する
    // 最小スコープのプラグイン。後段の rehype-image-cdn が visit できるようにするため
    // 先頭に置く。対象タグを含まない raw HTML には触れない
    rehypePlugins: [
      rehypeExtractMediaHtml,
      rehypeGithubEmoji,
      rehypeGithubAlert,
      rehypeKatex,
      [rehypeMermaid, { strategy: 'pre-mermaid' }],
      rehypeImageCdn,
    ],
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['mermaid', 'math'],
    },
    shikiConfig: {
      theme: 'github-light',
    },
  },

  output: 'static',
  adapter: node({
    mode: 'standalone',
  }),
});
