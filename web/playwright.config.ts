import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3001',
    video: 'on',
    screenshot: 'only-on-failure',
  },
  outputDir: '../.recordings/playwright-artifacts',
  reporter: [['list']],
});
