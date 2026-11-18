/** S-02: with proof required, the database checks the signed session itself. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createPersonalTestDatabase } from '../scripts/test-database';
import { issueSession, sealValue } from '../src/modules/identity/token';

const secret = 'synthetic-proof-test-key-' + 'z'.repeat(40);

test('preuve de session : sujet imposé par le jeton signé, falsification et expiration refusées', async () => {
  const db = await createPersonalTestDatabase({ sessionSecret: secret });
  const client = new pg.Client({ connectionString: db.apiUrl });
  await client.connect();
  const read = async (
    proof: string | null,
    subject = 'personal:demo-alpha',
    person = 'demo-alpha',
  ) => {
    await client.query('BEGIN');
    try {
      if (proof) await client.query("SELECT set_config('hc.session_proof',$1,true)", [proof]);
      return (await client.query('SELECT personal.api_get_record($1,$2) r', [subject, person]))
        .rows[0].r.status as string;
    } finally {
      await client.query('COMMIT');
    }
  };
  try {
    const alpha = issueSession('demo-alpha', secret);
    assert.equal(await read(alpha), 'ok');
    assert.equal(await read(null), 'forbidden', 'API role alone can no longer pick a subject');
    assert.equal(
      await read(alpha, 'personal:demo-beta', 'demo-beta'),
      'forbidden',
      'a valid token for Alex does not open Camille',
    );
    const [payload, sig] = alpha.split('.');
    const forged =
      Buffer.from(
        Buffer.from(payload, 'base64url')
          .toString()
          .replace(/demo-alpha/g, 'demo-beta'),
      ).toString('base64url') +
      '.' +
      sig;
    assert.equal(await read(forged, 'personal:demo-beta', 'demo-beta'), 'forbidden');
    assert.equal(await read(issueSession('demo-alpha', 'w'.repeat(40))), 'forbidden', 'other key');
    assert.equal(
      await read(issueSession('demo-alpha', secret, Date.now() - 2 * 3600_000)),
      'forbidden',
    );
    assert.equal(await read('not-a-token'), 'forbidden');
    assert.equal(
      await read(
        sealValue(
          { subject: 'personal:demo-alpha', personId: 'demo-alpha', expires: 'soon' },
          secret,
        ),
      ),
      'forbidden',
    );
    await assert.rejects(client.query('SELECT * FROM personal.session_key'), /permission denied/);
    const denied = (
      await db.admin.query("SELECT count(*)::int n FROM personal.audit WHERE event='denied_read'")
    ).rows[0].n;
    assert.ok(denied >= 6);
  } finally {
    await client.end();
    await db.drop();
  }
});
