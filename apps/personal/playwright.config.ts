import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    // Optional: reuse a preinstalled Chromium when the bundled one is absent.
    ...(process.env.HC_PLAYWRIGHT_CHROMIUM
      ? { launchOptions: { executablePath: process.env.HC_PLAYWRIGHT_CHROMIUM } }
      : {}),
  },
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 90_000,
    env: {
      HC_PERSONAL_STORAGE: process.env.HC_PERSONAL_E2E_STORAGE || 'local',
      ...(process.env.HC_PERSONAL_DATABASE_URL
        ? { HC_PERSONAL_DATABASE_URL: process.env.HC_PERSONAL_DATABASE_URL }
        : {}),
      HC_PERSONAL_DATA_DIR: mkdtempSync(join(tmpdir(), 'hc-personal-e2e-')),
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
