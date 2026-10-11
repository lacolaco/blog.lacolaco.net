// @ts-check
import eslint from '@eslint/js';
import { globalIgnores } from 'eslint/config';
import { importX } from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  globalIgnores(['.*', '**/*.js', 'node_modules', 'coverage', 'dist', 'build', 'functions', 'public']),
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
    // 宣言していない依存は shamefully-hoist で偶然解決されるだけで、パッケージマネージャの更新で壊れる。
    // 型だけの import も対象にして、@types/* の宣言漏れも検出する。
    files: ['src/**/*.{ts,tsx}', 'tools/**/*.ts'],
    plugins: { 'import-x': importX },
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true, includeTypes: true }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    settings: {},
    extends: [tseslint.configs.recommendedTypeChecked],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['tools/**/*.ts'],
    settings: {},
    extends: [tseslint.configs.recommendedTypeChecked],
    rules: {
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['tools/**/*.spec.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    rules: {
      '@typescript-eslint/no-floating-promises': ['off'],
    },
  },
);
