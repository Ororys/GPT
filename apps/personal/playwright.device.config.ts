import { defineConfig, devices } from '@playwright/test';
/** On-device mode (launch): static build of the app, no server. Run `npm run build:mobile` first. */
export default defineConfig({
  testDir: 'tests',
  testMatch: 'device.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3200',
    trace: 'off',
    ...devices['Pixel 7'],
    ...(process.env.HC_PLAYWRIGHT_CHROMIUM
      ? { launchOptions: { executablePath: process.env.HC_PLAYWRIGHT_CHROMIUM } }
      : {}),
  },
  webServer: {
    command: 'npx tsx scripts/serve-static.ts',
    url: 'http://127.0.0.1:3200/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
