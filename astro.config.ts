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

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.lacolaco.net',
  outDir: 'dist',
  integrations: [sitemap(), react()],

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
