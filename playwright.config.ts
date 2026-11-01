import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.baseUrl,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'api', testDir: './tests/api' },
    {
      name: 'chromium',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'], storageState: env.storageStatePath },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      testDir: './tests/ui',
      grep: /@mobile/,
      use: { ...devices['Pixel 7'], storageState: env.storageStatePath },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'node demo-app/server.js',
    url: `${env.baseUrl}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(env.port) },
  },
});
