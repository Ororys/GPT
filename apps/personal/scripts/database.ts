import pg from 'pg';
import {
  PDF_FIXTURES,
  fixturePdf,
  pdfDigest,
  type FixtureId,
} from '../src/modules/extraction/corpus';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { baseRecord, biomarkers } from '../src/modules/health-records/fixtures';
import { PERSON_ALPHA, PERSON_BETA } from '../src/modules/health-records/model';
import {
  importTemplate,
  TEMPLATE_TEXT,
  ImportSchema,
} from '../src/modules/documents/import-contract';
export async function prepareDatabase(adminUrl: string, apiUrl: string) {
  const api = new URL(apiUrl);
  if (!/^hc_personal_(test_)?login$/.test(api.username) || api.password.length < 32)
    throw Error('INVALID_PERSONAL_DATABASE_LOGIN');
  const login = api.username;
  const ident = pg.escapeIdentifier(login);
  const admin = new URL(adminUrl);
  if (admin.hostname !== api.hostname || admin.port !== api.port || admin.pathname !== api.pathname)
    throw Error('DATABASE_URL_MISMATCH');
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  try {
    await c.query('SELECT pg_advisory_lock(727002)');
    await c.query(
      'CREATE TABLE IF NOT EXISTS public.hc_personal_migration(name text PRIMARY KEY,sha256 text NOT NULL)',
    );
    const directory = new URL('../sql/', import.meta.url);
    for (const name of (await readdir(directory)).filter((n) => /^\d{3}_.+\.sql$/.test(n)).sort()) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const done = await c.query('SELECT sha256 FROM public.hc_personal_migration WHERE name=$1', [
        name,
      ]);
      if (done.rowCount) {
        if (done.rows[0].sha256 !== hash) throw Error('PERSONAL_MIGRATION_MODIFIED');
        continue;
      }
      await c.query('BEGIN');
      try {
        await c.query(sql);
        await c.query('INSERT INTO public.hc_personal_migration VALUES($1,$2)', [name, hash]);
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }
    }
    const exists = (await c.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [login])).rowCount;
    await c.query(
      `${exists ? 'ALTER' : 'CREATE'} ROLE ${ident} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION PASSWORD ${pg.escapeLiteral(decodeURIComponent(api.password))}`,
    );
    await c.query(`GRANT hc_personal_api TO ${ident}`);
    await c.query('BEGIN');
    try {
      for (const id of [...PDF_FIXTURES.map((f) => f.id), 'autre-profil'] as FixtureId[])
        await c.query('INSERT INTO personal.pdf_fixture VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [
          id,
          await pdfDigest(await fixturePdf(id)),
          id === 'autre-profil' ? 'demo-beta' : 'demo-alpha',
        ]);
      for (const b of biomarkers)
        await c.query(
          'INSERT INTO personal.biomarker VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING',
          [b.code, b.unit, JSON.stringify(b)],
        );
      for (const personId of [PERSON_ALPHA, PERSON_BETA]) {
        const record = baseRecord(personId);
        const {
          documents,
          observations,
          activities,
          sleep,
          events,
          biomarkers: _biomarkers,
          ...metadata
        } = record;
        await c.query('INSERT INTO personal.record VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING', [
          personId,
          JSON.stringify({ ...metadata, storage: 'postgresql' }),
        ]);
        await c.query(
          'INSERT INTO personal.actor(subject,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [`personal:${personId}`, personId],
        );
        // Demo profile prepared with both entry points allowed; visible in the consent history
        // as decided by the setup, and revocable from the settings.
        if (personId === PERSON_ALPHA)
          for (const source of ['pdf-documents', 'structured-import'])
            await c.query(
              "INSERT INTO personal.source_consent VALUES($1,$2,1,true,'seed:demo-setup',$3) ON CONFLICT DO NOTHING",
              [personId, source, '2026-11-18T09:00:00Z'],
            );
        for (const d of documents)
          await c.query(
            'INSERT INTO personal.document VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING',
            [personId, d.id, d.date, d.knownAt, JSON.stringify(d)],
          );
        for (const o of observations)
          await c.query(
            'INSERT INTO personal.observation VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT DO NOTHING',
            [
              personId,
              o.id,
              o.sourceId,
              o.code,
              o.unit,
              o.measuredAt,
              o.knownAt,
              JSON.stringify(o),
            ],
          );
        for (const [table, rows] of [
          ['activity', activities],
          ['sleep_session', sleep],
          ['life_event', events],
        ] as const) {
          for (const row of rows)
            await c.query(
              `INSERT INTO personal.${table} VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`,
              [personId, row.id, row.date, row.knownAt, JSON.stringify(row)],
            );
        }
      }
      ImportSchema.parse(importTemplate);
      const doc = {
        id: 'lab-2026-11-18',
        personId: PERSON_ALPHA,
        synthetic: true,
        title: 'Bilan biologique · novembre 2026 (import)',
        date: '2026-11-18T08:15:00Z',
        knownAt: '2026-11-18T10:00:00Z',
        laboratory: 'Laboratoire Atlas · fictif',
        pages: 1,
        kind: 'biology',
        status: 'needs-review',
      };
      await c.query(
        'INSERT INTO personal.import_fixture VALUES($1,$2,$3,$4::jsonb,$5::jsonb) ON CONFLICT DO NOTHING',
        [
          importTemplate.batchId,
          PERSON_ALPHA,
          createHash('sha256').update(TEMPLATE_TEXT).digest('hex'),
          JSON.stringify(doc),
          JSON.stringify(importTemplate.observations),
        ],
      );
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
  } finally {
    await c.query('SELECT pg_advisory_unlock(727002)').catch(() => {});
    await c.end();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.HC_SYNTHETIC_ONLY !== 'true') throw Error('HC_SYNTHETIC_ONLY=true required');
  if (!process.env.HC_PERSONAL_ADMIN_DATABASE_URL || !process.env.HC_PERSONAL_DATABASE_URL)
    throw Error('Personal database URLs required');
  await prepareDatabase(
    process.env.HC_PERSONAL_ADMIN_DATABASE_URL,
    process.env.HC_PERSONAL_DATABASE_URL,
  );
  console.log('Personal schema migrated and synthetic seed ready.');
}
