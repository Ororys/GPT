import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { createPersonalTestDatabase } from '../scripts/test-database';
import { prepareDatabase } from '../scripts/database';
import { TEMPLATE_TEXT } from '../src/modules/documents/import-contract';
let db: Awaited<ReturnType<typeof createPersonalTestDatabase>>;
before(async () => {
  db = await createPersonalTestDatabase();
});
after(async () => {
  await db?.drop();
});
const hash = createHash('sha256').update(TEMPLATE_TEXT).digest('hex');
async function read(subject = 'personal:demo-alpha', person = 'demo-alpha') {
  return (await db.api.query('SELECT personal.api_get_record($1,$2) r', [subject, person])).rows[0]
    .r;
}
async function imported(sha = hash, subject = 'personal:demo-alpha', person = 'demo-alpha') {
  return (await db.api.query('SELECT personal.api_import($1,$2,$3) r', [subject, person, sha]))
    .rows[0].r;
}
test('fresh migrations, stored entities and snapshot provenance', async () => {
  const r = await read();
  assert.equal(r.status, 'ok');
  assert.equal(r.record.storage, 'postgresql');
  assert.equal(r.record.documents.length, 7);
  assert.equal(r.record.observations.length, 36);
  assert.equal(r.record.activities.length, 52);
  assert.equal(r.record.sleep.length, 83);
  for (const o of r.record.observations) {
    assert.ok(r.record.documents.some((d: { id: string }) => d.id === o.sourceId));
    assert.equal(o.personId, 'demo-alpha');
    assert.equal(o.value, o.evidence.originalValue);
  }
  const tables = (
    await db.admin.query("SELECT tablename FROM pg_tables WHERE schemaname='personal'")
  ).rows;
  assert.equal(tables.length, 14);
});
test('SQL role has no direct data or internal function privileges, cannot become owner', async () => {
  for (const t of [
    'record',
    'actor',
    'observation',
    'document',
    'activity',
    'sleep_session',
    'import_fixture',
    'import_receipt',
    'audit',
  ])
    await assert.rejects(db.api.query(`SELECT * FROM personal.${t}`), /permission denied/);
  await assert.rejects(
    db.api.query("SELECT personal.guard('personal:demo-alpha','demo-alpha','read')"),
    /permission denied/,
  );
  await assert.rejects(db.api.query('SET ROLE hc_personal_owner'), /permission denied/);
  const r = (
    await db.api.query(
      'SELECT rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname=current_user',
    )
  ).rows[0];
  assert.deepEqual(r, { rolsuper: false, rolbypassrls: false, rolcreaterole: false });
});
test('patient isolation, invalid subjects and durable denied audit', async () => {
  const before = (
    await db.admin.query("SELECT count(*)::int n FROM personal.audit WHERE event='denied_read'")
  ).rows[0].n;
  for (const [subject, person] of [
    ['personal:demo-alpha', 'demo-beta'],
    ['personal:demo-beta', 'demo-alpha'],
    ['founder', 'demo-alpha'],
    ['personal:demo-alpha', "demo-alpha' OR true --"],
  ])
    assert.equal((await read(subject, person)).status, 'forbidden');
  assert.equal((await read('personal:demo-beta', 'demo-beta')).record.observations.length, 0);
  assert.equal(
    (await db.admin.query("SELECT count(*)::int n FROM personal.audit WHERE event='denied_read'"))
      .rows[0].n,
    before + 4,
  );
});
test('RLS: owner sees no dossier without authorized scope, no caller-controlled scope bypass', async () => {
  const c = await db.admin.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE hc_personal_owner');
    assert.equal((await c.query('SELECT count(*)::int n FROM personal.observation')).rows[0].n, 0);
    await c.query("SELECT set_config('hc.personal_scope','demo-beta',true)");
    assert.equal((await c.query('SELECT count(*)::int n FROM personal.observation')).rows[0].n, 0);
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }
  const c2 = await db.api.connect();
  try {
    await c2.query('BEGIN');
    await c2.query("SELECT set_config('hc.personal_scope','demo-alpha',true)");
    const r = await c2.query("SELECT personal.api_get_record('personal:demo-beta','demo-alpha') r");
    assert.equal(r.rows[0].r.status, 'forbidden');
  } finally {
    await c2.query('ROLLBACK');
    c2.release();
  }
});
test('database identity revocation takes effect on next read and import', async () => {
  await db.admin.query("UPDATE personal.actor SET active=false WHERE person_id='demo-alpha'");
  try {
    assert.equal((await read()).status, 'forbidden');
    assert.equal((await imported()).status, 'forbidden');
  } finally {
    await db.admin.query("UPDATE personal.actor SET active=true WHERE person_id='demo-alpha'");
  }
});
test('unknown fixture and cross-user import insert nothing', async () => {
  assert.equal((await imported('a'.repeat(64))).status, 'invalid');
  assert.equal((await imported(hash, 'personal:demo-beta', 'demo-alpha')).status, 'forbidden');
  assert.equal((await imported(hash, 'personal:demo-beta', 'demo-beta')).status, 'invalid');
  assert.equal((await read()).record.observations.length, 36);
});
test('atomicity: database insert failure rolls back document, observation, receipt and success audit', async () => {
  await db.admin.query(
    "CREATE FUNCTION personal.test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_INSERT_FAILURE'; END $$; CREATE TRIGGER test_failure BEFORE INSERT ON personal.observation FOR EACH ROW EXECUTE FUNCTION personal.test_fail()",
  );
  try {
    await assert.rejects(imported(), /TEST_INSERT_FAILURE/);
    assert.equal(
      (
        await db.admin.query(
          "SELECT count(*)::int n FROM personal.document WHERE id='lab-2026-11-18'",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await db.admin.query('SELECT count(*)::int n FROM personal.import_receipt')).rows[0].n,
      0,
    );
  } finally {
    await db.admin.query(
      'DROP TRIGGER test_failure ON personal.observation; DROP FUNCTION personal.test_fail()',
    );
  }
});
test('six concurrent clients: imported once, persistent receipt, identical retry', async () => {
  const values = await Promise.all(Array.from({ length: 6 }, () => imported()));
  assert.ok(values.every((v) => v.status === 'ok'));
  assert.equal(
    values.reduce((n, v) => n + v.inserted, 0),
    1,
  );
  assert.equal(
    values.reduce((n, v) => n + v.duplicates, 0),
    5,
  );
  assert.equal((await read()).record.observations.length, 37);
  assert.equal((await read()).record.documents.length, 8);
  const c = new pg.Client({ connectionString: db.apiUrl });
  await c.connect();
  try {
    const r = (
      await c.query('SELECT personal.api_import($1,$2,$3) r', [
        'personal:demo-alpha',
        'demo-alpha',
        hash,
      ])
    ).rows[0].r;
    assert.equal(r.inserted, 0);
    assert.equal(r.duplicates, 1);
  } finally {
    await c.end();
  }
});
test('immutable results, documents, receipts and audit; bad units rejected', async () => {
  for (const q of [
    'UPDATE personal.observation SET payload=payload',
    'DELETE FROM personal.observation',
    'TRUNCATE personal.observation CASCADE',
    'DELETE FROM personal.document',
    'DELETE FROM personal.import_receipt',
    'DELETE FROM personal.audit',
  ])
    await assert.rejects(db.admin.query(q), /IMMUTABLE_PERSONAL_RECORD/);
  await assert.rejects(
    db.admin.query(
      "INSERT INTO personal.observation SELECT person_id,'bad-unit',document_id,code,'WRONG',measured_at,known_at,jsonb_set(jsonb_set(jsonb_set(payload,'{id}','\"bad-unit\"'),'{unit}','\"WRONG\"'),'{evidence,originalUnit}','\"WRONG\"') FROM personal.observation LIMIT 1",
    ),
    /foreign key constraint/,
  );
});
test('migrations and seed rerun preserve imports and checksum', async () => {
  await prepareDatabase(db.adminUrl, db.apiUrl);
  assert.equal((await read()).record.observations.length, 37);
  assert.equal(
    (await db.admin.query('SELECT count(*)::int n FROM public.hc_personal_migration')).rows[0].n,
    2,
  );
  const row = (await db.admin.query('SELECT * FROM public.hc_personal_migration')).rows[0];
  await db.admin.query("UPDATE public.hc_personal_migration SET sha256='changed'");
  try {
    await assert.rejects(prepareDatabase(db.adminUrl, db.apiUrl), /PERSONAL_MIGRATION_MODIFIED/);
  } finally {
    await db.admin.query('UPDATE public.hc_personal_migration SET sha256=$1', [row.sha256]);
  }
});

let stagedPdf: import('../src/modules/extraction/native').PdfProposal;
async function stageProposal(
  p: import('../src/modules/extraction/native').PdfProposal,
  bytes: Uint8Array,
  subject = 'personal:demo-alpha',
  person = 'demo-alpha',
) {
  return (
    await db.api.query('SELECT personal.api_stage_pdf($1,$2,$3,$4,$5::jsonb) r', [
      subject,
      person,
      p.sha256,
      Buffer.from(bytes).toString('hex'),
      JSON.stringify(p),
    ])
  ).rows[0].r;
}
async function confirmProposal(
  p: import('../src/modules/extraction/native').PdfProposal,
  ids: string[],
) {
  return (
    await db.api.query('SELECT personal.api_confirm_pdf($1,$2,$3,$4::text[]) r', [
      'personal:demo-alpha',
      'demo-alpha',
      p.sha256,
      ids,
    ])
  ).rows[0].r;
}
test('PDF: native candidates staged with original bytes, no automatic observation insertion', async () => {
  const { fixturePdf } = await import('../src/modules/extraction/corpus');
  const { extractSyntheticPdf } = await import('../src/modules/extraction/native');
  const bytes = await fixturePdf('standard');
  stagedPdf = await extractSyntheticPdf(bytes, 'demo-alpha');
  const before = (await read()).record.observations.length;
  const staged = await stageProposal(stagedPdf, bytes);
  assert.equal(staged.status, 'ok');
  assert.equal(staged.reviewed, false);
  assert.equal(staged.proposal.candidates.length, 6);
  assert.equal((await read()).record.observations.length, before);
  const stored = (
    await db.api.query('SELECT personal.api_pdf_intake($1,$2,$3,true) r', [
      'personal:demo-alpha',
      'demo-alpha',
      stagedPdf.sha256,
    ])
  ).rows[0].r;
  assert.deepEqual(Buffer.from(stored.hex, 'hex'), Buffer.from(bytes));
});
test('PDF: cross-user intake and direct table access refused', async () => {
  const { fixturePdf } = await import('../src/modules/extraction/corpus');
  const bytes = await fixturePdf('standard');
  assert.equal(
    (await stageProposal(stagedPdf, bytes, 'personal:demo-beta', 'demo-alpha')).status,
    'forbidden',
  );
  assert.equal(
    (await stageProposal(stagedPdf, bytes, 'personal:demo-beta', 'demo-beta')).status,
    'invalid',
  );
  await assert.rejects(db.api.query('SELECT * FROM personal.pdf_intake'), /permission denied/);
  const r = (
    await db.api.query('SELECT personal.api_pdf_intake($1,$2,$3,true) r', [
      'personal:demo-beta',
      'demo-alpha',
      stagedPdf.sha256,
    ])
  ).rows[0].r;
  assert.equal(r.status, 'forbidden');
});
test('PDF: incompatible unit and forged selection cannot become observations', async () => {
  const { fixturePdf } = await import('../src/modules/extraction/corpus');
  const { extractSyntheticPdf } = await import('../src/modules/extraction/native');
  const bytes = await fixturePdf('unites');
  const p = await extractSyntheticPdf(bytes, 'demo-alpha');
  assert.equal((await stageProposal(p, bytes)).status, 'ok');
  assert.equal(
    (await confirmProposal(p, [p.candidates.find((c) => !c.eligible)!.id])).status,
    'invalid',
  );
  assert.equal((await confirmProposal(p, ['forged'])).status, 'invalid');
  assert.equal((await confirmProposal(p, [])).status, 'invalid');
});
test('PDF: failure during confirmation rolls back document, observations and review event', async () => {
  await db.admin.query(
    "CREATE FUNCTION personal.pdf_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_PDF_FAILURE'; END $$; CREATE TRIGGER pdf_test_failure BEFORE INSERT ON personal.observation FOR EACH ROW EXECUTE FUNCTION personal.pdf_test_fail()",
  );
  try {
    await assert.rejects(
      confirmProposal(
        stagedPdf,
        stagedPdf.candidates.map((c) => c.id),
      ),
      /TEST_PDF_FAILURE/,
    );
    assert.equal(
      (
        await db.admin.query('SELECT count(*)::int n FROM personal.document WHERE id=$1', [
          stagedPdf.id,
        ])
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await db.admin.query('SELECT count(*)::int n FROM personal.pdf_review')).rows[0].n,
      0,
    );
  } finally {
    await db.admin.query(
      'DROP TRIGGER pdf_test_failure ON personal.observation; DROP FUNCTION personal.pdf_test_fail()',
    );
  }
});
test('PDF: six concurrent confirmations insert each selected value once and preserve original units', async () => {
  const before = (await read()).record.observations.length;
  const ids = stagedPdf.candidates.map((c) => c.id);
  const results = await Promise.all(
    Array.from({ length: 6 }, () => confirmProposal(stagedPdf, ids)),
  );
  assert.ok(results.every((r) => r.status === 'ok'));
  assert.equal(
    results.reduce((n, r) => n + r.inserted, 0),
    6,
  );
  const r = await read();
  assert.equal(r.record.observations.length, before + 6);
  const ferritin = r.record.observations.find(
    (o: { sourceId: string; code: string }) => o.sourceId === stagedPdf.id && o.code === 'FERRITIN',
  );
  assert.equal(ferritin.unit, 'µg/L');
  assert.equal(ferritin.evidence.originalUnit, 'μg/L');
  assert.equal(ferritin.value, 64);
  assert.equal((await confirmProposal(stagedPdf, [ids[0]])).status, 'conflict');
  await assert.rejects(
    db.admin.query('DELETE FROM personal.pdf_review'),
    /IMMUTABLE_PERSONAL_RECORD/,
  );
});
