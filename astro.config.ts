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
import { imageCdnIntegration } from './tools/astro-integration-image-cdn';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.lacolaco.net',
  outDir: 'dist',
  integrations: [sitemap(), react(), imageCdnIntegration()],

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
    rehypePlugins: [rehypeGithubEmoji, rehypeGithubAlert, rehypeKatex, [rehypeMermaid, { strategy: 'pre-mermaid' }]],
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
