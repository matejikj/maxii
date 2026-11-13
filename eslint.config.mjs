import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const javascript = ['**/*.{js,cjs,mjs,jsx}'];
const typescript = ['**/*.{ts,cts,mts,tsx}'];

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.expo/**',
      '**/.expo-export/**',
      '**/.venv*/**',
      '**/.test-dist/**',
      'packages/lumi-forest/lib/**',
      '**/dist/**',
      '**/dist-*/**',
      '**/coverage/**',
      '**/exports/**',
      '**/previews/**',
      '**/reports/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/tests/*/actual/**',
      'apps/*/android/**',
      'apps/*/ios/**',
      '**/.rnstorybook/storybook.requires.ts',
    ],
  },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  { ...js.configs.recommended, files: [...javascript, ...typescript] },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: typescript })),
  {
    files: javascript,
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['**/*.cjs', 'apps/*/metro.config.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    files: [
      'apps/baby-tracker/tests/e2e/**/*.{js,mjs}',
      'apps/lumi-showcase/.rnstorybook/**/*.{js,mjs}',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['apps/baby-tracker/public/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: typescript,
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['**/*.{tsx,jsx}', '**/src/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['apps/baby-tracker/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lumi-showcase/**', '@lumi/showcase', '**/storybook/**', '@storybook/**'],
              message: 'Production app must not import showcase or Storybook.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/baby-tracker/src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-native', 'expo'].map((name) => ({
            name,
            message: 'Domain must stay free of UI/runtime packages.',
          })),
          patterns: [
            {
              group: [
                'expo-*',
                '@lumi/*',
                'react-native-*',
                '**/lumi-showcase/**',
                '**/storybook/**',
                '@storybook/**',
              ],
              message: 'Domain must stay free of UI/runtime packages.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
