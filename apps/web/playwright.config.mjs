import { defineConfig } from '@playwright/test';
let launchOptions = {};
if (process.env.USE_PACKAGED_CHROMIUM === '1') {
  const { default: chromium } = await import('@sparticuz/chromium');
  launchOptions = { executablePath: await chromium.executablePath(), args: chromium.args.filter(arg => arg !== '--single-process') };
}
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:3000', launchOptions, headless: true },
  reporter: 'list', workers: 1,
  webServer: {
    command: 'npm run start -- --hostname 0.0.0.0 --port 3000',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    env: { AUTH_SECRET: 'test-only-not-a-production-secret', AUTH_TRUST_HOST: 'true', DATABASE_URL: '' },
    timeout: 30000,
  },
});
