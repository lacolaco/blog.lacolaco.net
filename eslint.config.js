// @ts-check
import eslint from '@eslint/js';
import { globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  globalIgnores(['.*', '**/*.js', 'node_modules', 'coverage', 'dist', 'build', 'functions', 'public', 'src']),
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslint.configs.recommended,
  {
    files: ['tools/**/*.ts'],
    settings: {},
    extends: [tseslint.configs.recommendedTypeChecked],
  },
  {
    files: ['tools/**/*.spec.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    rules: {
      '@typescript-eslint/no-floating-promises': ['off'],
    },
  },
);
