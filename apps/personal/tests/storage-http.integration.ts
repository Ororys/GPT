import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createPersonalTestDatabase } from '../scripts/test-database';
import { issueSession } from '../src/modules/identity/token';
let db: Awaited<ReturnType<typeof createPersonalTestDatabase>>;
before(async () => {
  db = await createPersonalTestDatabase();
});
after(async () => {
  await db?.drop();
});
async function probe(url: string) {
  const secret = 'synthetic-http-probe-secret-0123456789abcdef';
  const base = 'http://127.0.0.1:3101';
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3101'],
    {
      stdio: 'ignore',
      env: {
        ...process.env,
        HC_PERSONAL_STORAGE: 'postgres',
        HC_PERSONAL_DATABASE_URL: url,
        HC_PERSONAL_SESSION_SECRET: secret,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  );
  try {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      try {
        const r = await fetch(base);
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      if (child.exitCode !== null) throw Error('Probe server exited');
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, 'probe server must start');
    const response = await fetch(base + '/api/records/demo-alpha', {
      headers: { cookie: 'hc_personal_demo=' + issueSession('demo-alpha', secret) },
    });
    return { status: response.status, data: await response.json() };
  } finally {
    const exit = once(child, 'exit');
    child.kill('SIGTERM');
    await exit;
  }
}
test('unavailable PostgreSQL produces 503, never a fixture dossier', async () => {
  const url = new URL(db.apiUrl);
  url.port = '56499';
  const r = await probe(url.href);
  assert.equal(r.status, 503);
  assert.equal(r.data.error, 'DATABASE_UNAVAILABLE');
  assert.equal(r.data.record, undefined);
  assert.equal(r.data.observations, undefined);
});
test('application refuses an administrator connection instead of bypassing RLS', async () => {
  const r = await probe(db.adminUrl);
  assert.equal(r.status, 503);
  assert.equal(r.data.error, 'UNSAFE_DATABASE_ROLE');
  assert.equal(r.data.record, undefined);
});
