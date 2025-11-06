import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@lib/notion': path.resolve(__dirname, './src/libs/notion/index.ts'),
      '@lib/post': path.resolve(__dirname, './src/libs/post/index.ts'),
      '@lib/i18n': path.resolve(__dirname, './src/libs/i18n/index.ts'),
      '@lib/query': path.resolve(__dirname, './src/libs/query/index.ts'),
    },
  },
});
