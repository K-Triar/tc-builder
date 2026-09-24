import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strict,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    // ドメイン層は純粋関数のみ。React・ストア・保存層への依存を禁止する
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'src/domain では React を使わない',
            },
            {
              group: ['idb-keyval', 'zustand', 'zustand/*'],
              message: 'src/domain ではブラウザ API・ストアに依存しない',
            },
            {
              group: ['**/ui/**', '**/store/**', '**/storage/**'],
              message: 'src/domain から UI・ストア・保存層を参照しない',
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
