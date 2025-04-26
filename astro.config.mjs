import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

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
});
