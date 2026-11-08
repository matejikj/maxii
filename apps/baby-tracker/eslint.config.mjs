import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Lint stays intentionally thin: type-aware noise from Expo templates is avoided,
 * while hooks rules and domain import bans catch the high-risk mistakes.
 */
export default tseslint.config(
  {
    ignores: [
      'dist-*/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'node_modules/**',
      'metro.config.js',
      'playwright.config.mjs',
      'public/**',
      'tests/e2e/**',
      'tests/ts-resolve-*.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Domain must stay free of React.' },
            { name: 'react-native', message: 'Domain must stay free of React Native.' },
            { name: 'expo', message: 'Domain must stay free of Expo.' },
          ],
          patterns: [
            { group: ['expo-*', '@lumi/*', 'react-native-*'], message: 'Domain must stay free of UI/runtime packages.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'App.tsx', 'index.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/lumi-showcase/**', '@lumi/showcase', '**/storybook/**', '@storybook/**'], message: 'Production app must not import showcase or Storybook.' },
          ],
        },
      ],
    },
  },
);
