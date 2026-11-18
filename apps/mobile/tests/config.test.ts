import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const load = (env: Record<string, string>) =>
  execFileSync(
    process.execPath,
    ['--import', 'tsx', '-e', "import('./capacitor.config.ts').then(m=>console.log(JSON.stringify(m.default)))"],
    { env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
test('serveur : HTTPS obligatoire hors développement local, navigation limitée à ce serveur', () => {
  const prod = JSON.parse(load({ CONVERGENCE_SERVER_URL: 'https://app.example.test' }));
  assert.equal(prod.server.url, 'https://app.example.test');
  assert.equal(prod.server.cleartext, false);
  assert.deepEqual(prod.server.allowNavigation, ['app.example.test']);
  assert.deepEqual(prod.plugins.SystemBars, {
    insetsHandling: 'css',
    initialViewportFitValueHint: 'cover',
  });
  assert.throws(() => load({ CONVERGENCE_SERVER_URL: 'http://app.example.test' }));
  assert.equal(JSON.parse(load({ CONVERGENCE_SERVER_URL: 'http://10.0.2.2:3000' })).server.cleartext, true);
});
test('Android : aucune écriture santé, lecture limitée aux cinq types utilisés', () => {
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  const plugin = readFileSync('node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml', 'utf8');
  const declared = [...plugin.matchAll(/android\.permission\.health\.([A-Z_]+)/g)].map((m) => m[1]);
  const removed = new Set(
    [...manifest.matchAll(/health\.([A-Z_]+)" tools:node="remove"/g)].map((m) => m[1]),
  );
  const kept = declared.filter((p) => !removed.has(p)).sort();
  assert.deepEqual(kept, [
    'READ_DISTANCE',
    'READ_HEART_RATE_VARIABILITY',
    'READ_RESTING_HEART_RATE',
    'READ_SLEEP',
    'READ_STEPS',
  ]);
  assert.match(readFileSync('android/variables.gradle', 'utf8'), /minSdkVersion = 26/);
});
test('iOS : HealthKit déclaré, message d’usage en français, aucune écriture annoncée', () => {
  const plist = readFileSync('ios/App/App/Info.plist', 'utf8');
  assert.match(plist, /NSHealthShareUsageDescription<\/key>\s*<string>Convergence lit, avec votre accord/);
  assert.match(plist, /NSHealthUpdateUsageDescription<\/key>\s*<string>Convergence n’écrit aucune donnée/);
  assert.match(readFileSync('ios/App/App/App.entitlements', 'utf8'), /com\.apple\.developer\.healthkit/);
  assert.equal(
    (readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8').match(/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g) || []).length,
    2,
  );
});
