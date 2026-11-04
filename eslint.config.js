import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'playwright-report',
      'blob-report',
      'test-results',
      'allure-results',
      'allure-report',
      '.auth',
      'demo-app/public',
      'src/grpc/generated',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['expectResponse'] }],
      'playwright/no-conditional-in-test': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/prefer-web-first-assertions': 'error',
    },
  },
  {
    files: ['demo-app/**/*.js'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly' } },
  },
);
