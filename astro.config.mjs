import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.lacolaco.net',
  integrations: [sitemap(), tailwind(), react()],
  vite: {
    optimizeDeps: { exclude: ['@resvg/resvg-js'] },
  },
});
