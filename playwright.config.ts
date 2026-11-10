import { defineConfig } from '@playwright/test';

const deployedURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: deployedURL || 'http://127.0.0.1:4173',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: deployedURL
    ? undefined
    : {
        command: 'node scripts/preview.mjs',
        cwd: './apps/web',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
      },
});
