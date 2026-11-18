import type { CapacitorConfig } from '@capacitor/cli';
/**
 * The native app opens the same server as the website (same screens, same session cookie,
 * same Host/Origin checks). CONVERGENCE_SERVER_URL is set at build time:
 * - production: the HTTPS address of the hosted application (not chosen yet, B-02);
 * - development: http://10.0.2.2:3000 (Android emulator → this computer).
 * Plain HTTP is accepted only for local development addresses.
 */
const url = process.env.CONVERGENCE_SERVER_URL || 'http://10.0.2.2:3000';
const parsed = new URL(url);
const local = ['10.0.2.2', '127.0.0.1', 'localhost'].includes(parsed.hostname);
if (parsed.protocol !== 'https:' && !local)
  throw new Error('CONVERGENCE_SERVER_URL must use HTTPS outside local development');
const config: CapacitorConfig = {
  appId: 'fr.convergence.personal',
  appName: 'Convergence',
  // Shown only if the server cannot be reached.
  webDir: 'www',
  server: {
    url,
    cleartext: parsed.protocol === 'http:',
    allowNavigation: [parsed.host],
    errorPath: 'offline.html',
  },
  ios: { contentInset: 'automatic', limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
  plugins: {
    // Edge-to-edge: the page declares viewport-fit=cover and pads with env(safe-area-inset-*).
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
  },
};
export default config;
