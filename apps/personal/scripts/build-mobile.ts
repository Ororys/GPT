/**
 * Builds the screens of the mobile app for the launch mode « données sur le téléphone »:
 * static pages embedded in the app, no server, the record stored encrypted on the phone.
 *
 * The hosted version (API routes, PostgreSQL, OIDC, proxy) is left untouched: the build
 * runs on a temporary copy where only what a server needs is removed, then the result is
 * copied to apps/mobile/dist (Capacitor's webDir in this mode).
 *
 * Usage: npm run build:mobile
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const app = resolve(import.meta.dirname, '..');
const target = resolve(app, '../mobile/dist');
// Inside the app folder so that node_modules resolves and Turbopack's root contains it.
const work = mkdtempSync(join(app, '.mobile-build-'));
/** Only this page origin is ever contacted: no analytics, no external service (RGPD art. 25). */
export const DEVICE_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'self' blob:";
function patch(file: string, from: string | RegExp, to: string) {
  const path = join(work, file);
  const text = readFileSync(path, 'utf8');
  const next = text.replace(from, to);
  if (next === text) throw Error(`build-mobile: patch not applied to ${file}`);
  writeFileSync(path, next);
}
try {
  for (const entry of [
    'src',
    'public',
    'package.json',
    'tsconfig.json',
    'next.config.ts',
    'postcss.config.mjs',
  ])
    if (existsSync(join(app, entry)))
      cpSync(join(app, entry), join(work, entry), { recursive: true });
  // Server-only parts: API routes, request proxy, chart benchmark page.
  for (const path of ['src/app/api', 'src/proxy.ts', 'src/app/lab'])
    rmSync(join(work, path), { recursive: true, force: true });
  patch('src/app/layout.tsx', /export const dynamic = 'force-dynamic';\n/, '');
  patch(
    'src/app/layout.tsx',
    '<body>',
    `<head><meta httpEquiv="Content-Security-Policy" content="${DEVICE_CSP}" /></head><body>`,
  );
  patch(
    'src/app/[[...section]]/page.tsx',
    'export default async function Page',
    `export const dynamicParams = false;
export function generateStaticParams() {
  return [[], ['biology'], ['sport'], ['documents'], ['timeline'], ['settings']].map((section) => ({ section }));
}
export default async function Page`,
  );
  patch(
    'next.config.ts',
    'poweredByHeader: false,',
    "poweredByHeader: false, output: 'export', trailingSlash: true, images: { unoptimized: true },",
  );
  patch(
    'next.config.ts',
    /turbopack: \{ root: [^}]*\}/,
    `turbopack: { root: ${JSON.stringify(app)} }`,
  );
  patch(
    'next.config.ts',
    /outputFileTracingRoot: fileURLToPath\(new URL\('\.', import\.meta\.url\)\),/,
    `outputFileTracingRoot: ${JSON.stringify(app)},`,
  );
  // Response headers do not exist in a static export; the CSP above replaces them.
  patch('next.config.ts', /async headers\(\) \{[\s\S]*?\n  \},\n/, '');
  execFileSync(process.execPath, [join(app, 'node_modules/next/dist/bin/next'), 'build'], {
    cwd: work,
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_HC_RUNTIME: 'device', NEXT_TELEMETRY_DISABLED: '1' },
  });
  rmSync(target, { recursive: true, force: true });
  cpSync(join(work, 'out'), target, { recursive: true });
  // Privacy page and offline page of the app stay available.
  for (const page of ['privacypolicy.html'])
    cpSync(resolve(app, '../mobile/www', page), join(target, page));
  console.log(`Application mobile (données sur le téléphone) : ${target}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
