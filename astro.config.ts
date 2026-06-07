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
import remarkResolveNotionMentions from './tools/remark-resolve-notion-mentions';
import rehypeImageCdn from './tools/rehype-image-cdn';
import rehypeExtractVideoHtml from './tools/rehype-extract-video-html';

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
    // remarkResolveNotionMentions は notion-sync が出力する `[plain_text](https://www.notion.so/...)`
    // 形式の page mention link を、frontmatter `notion_url` で照合して blog 内相対 URL に書き換える。
    // 未解決の notion.so link は build error にする（publication invariant: 未公開 page への mention を
    // 残さない）。URL 書き換えのみで構造は触らないため、remark チェーンの末尾に置いて差し支えない
    remarkPlugins: [remarkBreaks, remarkMath, remarkEmbed, remarkResolveNotionMentions],
    // rehypeExtractVideoHtml は notion-sync が出力する <video> を含む raw ノードのみを
    // element 化する最小スコープのプラグイン。後段の rehype-image-cdn が <video> を
    // visit できるようにするため先頭に置く。<video> を含まない raw HTML には触れない
    rehypePlugins: [
      rehypeExtractVideoHtml,
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
