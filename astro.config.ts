import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { createMarkdownConfig } from './tools/markdown-pipeline';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.lacolaco.net',
  outDir: 'dist',
  // Astro v7 の既定 ('jsx') はタグの間の空白を落とし、リンクや強調などインライン要素が
  // 隣り合う箇所の見た目が変わりうる。v6 までの空白の扱いに合わせるため true にする
  compressHTML: true,
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

  // 記事の変換設定は tools/markdown-pipeline にあり、処理系を Sätteri にしている理由もそこに書いてある
  markdown: createMarkdownConfig(),

  output: 'static',
  adapter: node({
    mode: 'standalone',
  }),
});
