import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './packages/frontend/tests',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5179',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1300, height: 2200 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5179 --strictPort',
    cwd: './packages/frontend',
    url: 'http://127.0.0.1:5179/tests/render-parity.html',
    reuseExistingServer: !process.env.CI,
  },
});
