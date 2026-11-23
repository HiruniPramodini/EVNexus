import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

// Existing shell variables win over the ignored, local .env.test file.
const local = loadEnv('test', process.cwd(), '');
for (const [key, value] of Object.entries(local)) process.env[key] ??= value;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100';
const external = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1';
const port = new URL(baseURL).port || '3100';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'Asia/Colombo',
    geolocation: { latitude: 6.9271, longitude: 79.8612 },
    permissions: ['geolocation'],
    serviceWorkers: 'block',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'ui', testMatch: '**/ui/**/*.spec.js' },
    { name: 'e2e', testMatch: '**/e2e/**/*.spec.js', fullyParallel: false, retries: 0 },
  ],
  webServer: external ? undefined : {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_API_GATEWAY_URL: process.env.E2E_API_URL || 'http://127.0.0.1:5000' },
  },
});
