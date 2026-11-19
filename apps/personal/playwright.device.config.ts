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
  // Static app, the real relay, and a local stand-in for OpenAI (no key, no network).
  // Build first with: NEXT_PUBLIC_HC_AI_RELAY_URL=http://127.0.0.1:3300 npm run build:mobile
  webServer: [
    {
      command: 'npx tsx scripts/serve-static.ts',
      url: 'http://127.0.0.1:3200/',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npx tsx tests/helpers/fake-openai.ts',
      port: 3400,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npx tsx ../relay/src/server.ts',
      port: 3300,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PORT: '3300',
        OPENAI_API_KEY: 'cle-de-test',
        OPENAI_MODEL: 'modele-de-test',
        OPENAI_BASE_URL: 'http://127.0.0.1:3400/v1',
        RELAY_ALLOWED_ORIGINS: 'http://127.0.0.1:3200',
      },
    },
  ],
});
