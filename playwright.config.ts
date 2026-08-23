import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: 0,
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3046/call-desk',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3046',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: 'line',
});
