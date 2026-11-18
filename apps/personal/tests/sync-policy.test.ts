import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAutoSync, SYNC_EVERY_MS } from '../src/modules/device/sync-policy';
const now = Date.parse('2026-11-18T12:00:00Z');
test('synchronisation automatique : application, autorisation, au plus toutes les 6 h', () => {
  const base = { native: true, consentGranted: true, lastSync: null, now };
  assert.equal(shouldAutoSync(base), true, 'first time');
  assert.equal(shouldAutoSync({ ...base, native: false }), false, 'never in a browser');
  assert.equal(shouldAutoSync({ ...base, consentGranted: false }), false, 'never without consent');
  assert.equal(
    shouldAutoSync({ ...base, lastSync: new Date(now - 3600_000).toISOString() }),
    false,
  );
  assert.equal(
    shouldAutoSync({ ...base, lastSync: new Date(now - SYNC_EVERY_MS).toISOString() }),
    true,
  );
  assert.equal(shouldAutoSync({ ...base, lastSync: 'garbage' }), true);
  assert.equal(shouldAutoSync({ ...base, lastSync: new Date(now + 3600_000).toISOString() }), true);
});
