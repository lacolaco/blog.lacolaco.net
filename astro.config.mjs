import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import rehypeGithubEmoji from 'rehype-github-emoji';
import rehypeGithubAlert from 'rehype-github-alert';

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.lacolaco.net',
  integrations: [sitemap(), react()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: { exclude: ['@resvg/resvg-js'] },
  },
  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
  },
  markdown: {
    gfm: true,
    remarkPlugins: [remarkBreaks, remarkMath],
    rehypePlugins: [rehypeGithubEmoji, rehypeGithubAlert, rehypeKatex, [rehypeMermaid, { strategy: 'img-svg' }]],
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['mermaid', 'math'],
    },
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
