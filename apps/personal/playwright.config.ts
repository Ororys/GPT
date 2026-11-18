import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: 'tests',
  // Real sign-in runs its own journey against a test OpenID provider (scripts/e2e-oidc.ts).
  testMatch: process.env.HC_PERSONAL_E2E_AUTH === 'oidc' ? 'oidc.spec.ts' : 'personal.spec.ts',
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
      ...(process.env.HC_PERSONAL_E2E_AUTH === 'oidc'
        ? {
            HC_PERSONAL_AUTH: 'oidc',
            HC_PERSONAL_OIDC_ISSUER: process.env.HC_PERSONAL_OIDC_ISSUER!,
            HC_PERSONAL_OIDC_CLIENT_ID: process.env.HC_PERSONAL_OIDC_CLIENT_ID!,
            HC_PERSONAL_OIDC_CLIENT_SECRET: process.env.HC_PERSONAL_OIDC_CLIENT_SECRET!,
            HC_PERSONAL_OIDC_REDIRECT_URI: 'http://127.0.0.1:3100/api/auth/callback',
          }
        : {}),
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
