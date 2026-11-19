import type { CapacitorConfig } from '@capacitor/cli';
/**
 * Two modes, chosen at build time:
 *
 * - Default (launch decision of 19 November 2026): the screens are embedded in the app
 *   (`dist`, built by `npm run build:mobile` in apps/personal). No server: the record stays
 *   encrypted on the phone and the page may only contact itself (CSP connect-src 'self').
 * - CONVERGENCE_SERVER_URL set: the app opens the hosted version (same screens as the
 *   website, PostgreSQL, real sign-in). HTTPS required outside local development addresses
 *   (e.g. http://10.0.2.2:3000 for the Android emulator).
 */
const remote = process.env.CONVERGENCE_SERVER_URL;
let server: CapacitorConfig['server'];
if (remote) {
  const parsed = new URL(remote);
  const local = ['10.0.2.2', '127.0.0.1', 'localhost'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !local)
    throw new Error('CONVERGENCE_SERVER_URL must use HTTPS outside local development');
  server = {
    url: remote,
    cleartext: parsed.protocol === 'http:',
    allowNavigation: [parsed.host],
    errorPath: 'offline.html',
  };
}
const config: CapacitorConfig = {
  appId: 'fr.convergence.personal',
  appName: 'Convergence',
  // Remote mode: shown only if the server cannot be reached. Local mode: the app itself.
  webDir: remote ? 'www' : 'dist',
  ...(server ? { server } : {}),
  ios: { contentInset: 'automatic', limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
  plugins: {
    // Edge-to-edge: the page declares viewport-fit=cover and pads with env(safe-area-inset-*).
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
  },
};
export default config;
