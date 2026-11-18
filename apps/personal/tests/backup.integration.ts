/**
 * Backup and restore drill on a disposable database: pg_dump (custom format) → new
 * database → pg_restore, then the restored copy must be identical and keep its protections.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { createPersonalTestDatabase } from '../scripts/test-database';

const tables = async (c: pg.Pool | pg.Client) =>
  (
    await c.query("SELECT tablename FROM pg_tables WHERE schemaname='personal' ORDER BY tablename")
  ).rows.map((r) => r.tablename as string);
const counts = async (c: pg.Client | pg.Pool) => {
  const out: Record<string, number> = {};
  for (const t of await tables(c))
    out[t] = (await c.query(`SELECT count(*)::int n FROM personal.${t}`)).rows[0].n;
  return out;
};

test('sauvegarde et restauration : copie identique, migrations, RLS et immuabilité conservées', async () => {
  const db = await createPersonalTestDatabase();
  const dir = mkdtempSync(join(tmpdir(), 'hc-backup-'));
  const restored = new URL(db.adminUrl);
  restored.pathname = restored.pathname + '_restored';
  const root = new URL(db.adminUrl);
  root.pathname = '/postgres';
  try {
    // Some activity worth restoring: a read (audit row) and a permission decision.
    await db.api.query('SELECT personal.api_get_record($1,$2)', [
      'personal:demo-alpha',
      'demo-alpha',
    ]);
    await db.api.query('SELECT personal.api_set_consent($1,$2,$3,$4,$5)', [
      'personal:demo-alpha',
      'demo-alpha',
      'device-health',
      0,
      true,
    ]);
    const file = join(dir, 'personal.dump');
    execFileSync('pg_dump', ['--format=custom', '--file', file, db.adminUrl]);
    const c = new pg.Client({ connectionString: root.href });
    await c.connect();
    await c.query(`CREATE DATABASE ${restored.pathname.slice(1)}`);
    await c.end();
    execFileSync('pg_restore', ['--exit-on-error', '--dbname', restored.href, file]);

    const before = await counts(db.admin);
    const copy = new pg.Client({ connectionString: restored.href });
    await copy.connect();
    try {
      assert.deepEqual(await counts(copy), before);
      assert.deepEqual(
        (await copy.query('SELECT name,sha256 FROM public.hc_personal_migration ORDER BY name'))
          .rows,
        (await db.admin.query('SELECT name,sha256 FROM public.hc_personal_migration ORDER BY name'))
          .rows,
      );
      // Protections survive the restore.
      const rls = (
        await copy.query(
          "SELECT count(*)::int n FROM pg_class WHERE relnamespace='personal'::regnamespace AND relkind='r' AND NOT (relrowsecurity AND relforcerowsecurity)",
        )
      ).rows[0].n;
      assert.equal(rls, 0, 'every personal table keeps forced RLS');
      await assert.rejects(
        copy.query('DELETE FROM personal.observation'),
        /IMMUTABLE_PERSONAL_RECORD/,
      );
      // The restored copy serves the same dossier through the API role.
      const api = new URL(restored.href);
      const original = new URL(db.apiUrl);
      api.username = original.username;
      api.password = original.password;
      const apiClient = new pg.Client({ connectionString: api.href });
      await apiClient.connect();
      try {
        const r = (
          await apiClient.query('SELECT personal.api_get_record($1,$2) r', [
            'personal:demo-alpha',
            'demo-alpha',
          ])
        ).rows[0].r;
        const o = (
          await db.api.query('SELECT personal.api_get_record($1,$2) r', [
            'personal:demo-alpha',
            'demo-alpha',
          ])
        ).rows[0].r;
        assert.deepEqual(r.record, o.record);
        await assert.rejects(
          apiClient.query('SELECT * FROM personal.observation'),
          /permission denied/,
        );
        const consent = (
          await apiClient.query('SELECT personal.api_consents($1,$2) r', [
            'personal:demo-alpha',
            'demo-alpha',
          ])
        ).rows[0].r.consents.find((x: { source: string }) => x.source === 'device-health');
        assert.equal(consent.granted, true);
      } finally {
        await apiClient.end();
      }
    } finally {
      await copy.end();
    }
  } finally {
    const c = new pg.Client({ connectionString: root.href });
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS ${restored.pathname.slice(1)} WITH (FORCE)`);
    await c.end();
    rmSync(dir, { recursive: true, force: true });
    await db.drop();
  }
});
