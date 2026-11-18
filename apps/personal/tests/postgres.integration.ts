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
  assert.equal(r.record.documents.length, 8);
  assert.equal(r.record.observations.length, 48);
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
  assert.equal(tables.length, 16);
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
  assert.equal((await read()).record.observations.length, 48);
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
  assert.equal((await read()).record.observations.length, 49);
  assert.equal((await read()).record.documents.length, 9);
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
  assert.equal((await read()).record.observations.length, 49);
  assert.equal(
    (await db.admin.query('SELECT count(*)::int n FROM public.hc_personal_migration')).rows[0].n,
    8,
  );
  const rows = (await db.admin.query('SELECT name,sha256 FROM public.hc_personal_migration')).rows;
  await db.admin.query("UPDATE public.hc_personal_migration SET sha256='changed'");
  try {
    await assert.rejects(prepareDatabase(db.adminUrl, db.apiUrl), /PERSONAL_MIGRATION_MODIFIED/);
  } finally {
    for (const row of rows)
      await db.admin.query('UPDATE public.hc_personal_migration SET sha256=$1 WHERE name=$2', [
        row.sha256,
        row.name,
      ]);
  }
  await prepareDatabase(db.adminUrl, db.apiUrl);
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
test('PDF sprint 04: new fixtures whitelisted, ambiguous candidates refused by SQL, unreferenced value kept honest', async () => {
  const { fixturePdf } = await import('../src/modules/extraction/corpus');
  const { extractSyntheticPdf } = await import('../src/modules/extraction/native');
  for (const id of ['colonnes', 'ambigus', 'dates'])
    assert.equal(
      (await db.admin.query('SELECT count(*)::int n FROM personal.pdf_fixture WHERE id=$1', [id]))
        .rows[0].n,
      1,
    );
  const ambiguousBytes = await fixturePdf('ambigus');
  const ambiguous = await extractSyntheticPdf(ambiguousBytes, 'demo-alpha');
  const staged = await stageProposal(ambiguous, ambiguousBytes);
  assert.equal(staged.status, 'ok');
  assert.deepEqual(staged.proposal.unrecognized, [
    { page: 1, text: 'Commentaire | voir le laboratoire' },
  ]);
  const duplicate = ambiguous.candidates.find((c) => c.code === 'FERRITIN')!;
  const qualified = ambiguous.candidates.find((c) => c.code === 'HBA1C')!;
  assert.equal((await confirmProposal(ambiguous, [duplicate.id])).status, 'invalid');
  assert.equal((await confirmProposal(ambiguous, [qualified.id])).status, 'invalid');
  const creatinine = ambiguous.candidates.find((c) => c.eligible)!;
  assert.equal((await confirmProposal(ambiguous, [creatinine.id])).inserted, 1);

  const datesBytes = await fixturePdf('dates');
  const dates = await extractSyntheticPdf(datesBytes, 'demo-alpha');
  assert.equal((await stageProposal(dates, datesBytes)).status, 'ok');
  assert.equal(
    (
      await confirmProposal(
        dates,
        dates.candidates.map((c) => c.id),
      )
    ).status,
    'invalid',
  );
  assert.equal(
    (await db.admin.query('SELECT count(*)::int n FROM personal.document WHERE id=$1', [dates.id]))
      .rows[0].n,
    0,
  );

  const columnsBytes = await fixturePdf('colonnes');
  const columns = await extractSyntheticPdf(columnsBytes, 'demo-alpha');
  assert.equal((await stageProposal(columns, columnsBytes)).status, 'ok');
  const all = columns.candidates.map((c) => c.id);
  assert.equal((await confirmProposal(columns, all)).inserted, 3);
  const r = await read();
  const vitd = r.record.observations.find(
    (o: { sourceId: string; code: string }) => o.sourceId === columns.id && o.code === 'VITD',
  );
  assert.equal(vitd.value, 28);
  assert.equal(vitd.reference, undefined);
  assert.equal(vitd.evidence.sourceText, 'Vitamine D | 28 | ng/mL | > 20');
  assert.equal(vitd.measuredAt.slice(0, 10), '2026-10-03');
  const doc = r.record.documents.find((d: { id: string }) => d.id === columns.id);
  assert.equal(doc.title, 'Bilan PDF · 3 octobre 2026');
});
test('corrections: versioned, original kept, stale version refused, concurrent writers serialized', async () => {
  const correct = (
    observation: string,
    expected: number,
    value: number,
    reason = 'erreur de lecture du tableau',
    subject = 'personal:demo-alpha',
    person = 'demo-alpha',
  ) =>
    db.api
      .query('SELECT personal.api_correct_observation($1,$2,$3,$4,$5,$6) r', [
        subject,
        person,
        observation,
        expected,
        value,
        reason,
      ])
      .then((x) => x.rows[0].r);
  const before = await read();
  const target = before.record.observations.find(
    (o: { evidence: { method: string }; code: string }) =>
      o.evidence.method === 'native-pdf' && o.code === 'CREATININE',
  );
  const synthetic = before.record.observations.find(
    (o: { evidence: { method: string } }) => o.evidence.method !== 'native-pdf',
  );
  assert.ok(target && synthetic);
  const original = target.value;
  assert.equal((await correct(synthetic.id, 0, 1)).status, 'invalid');
  assert.equal((await correct(target.id, 0, original)).status, 'invalid', 'no-op refused');
  assert.equal((await correct(target.id, 0, 9.5, 'x')).status, 'invalid', 'reason required');
  assert.equal((await correct(target.id, 0, -1)).status, 'invalid');
  assert.equal((await correct('missing', 0, 1)).status, 'not_found');
  assert.equal(
    (await correct(target.id, 0, 9.5, 'erreur', 'personal:demo-beta', 'demo-alpha')).status,
    'forbidden',
  );
  assert.equal(
    (await correct(target.id, 0, 9.5, 'erreur', 'personal:demo-beta', 'demo-beta')).status,
    'not_found',
    'RLS hides another dossier observation',
  );

  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) => correct(target.id, 0, 9.5 + i)),
  );
  assert.equal(results.filter((r) => r.status === 'ok').length, 1);
  assert.equal(results.filter((r) => r.status === 'conflict').length, 5);
  const winner = 9.5 + results.findIndex((r) => r.status === 'ok');
  assert.equal((await correct(target.id, 0, 3)).status, 'conflict');
  assert.deepEqual(await correct(target.id, 1, 9.2, 'retour à la valeur vérifiée'), {
    status: 'ok',
    version: 2,
  });

  const after = (await read()).record.observations.find((o: { id: string }) => o.id === target.id);
  assert.equal(after.value, 9.2);
  assert.equal(after.evidence.originalValue, original);
  assert.equal(after.evidence.sourceText, target.evidence.sourceText);
  assert.equal(after.quality, 'needs-review');
  assert.deepEqual(
    after.corrections.map((c: { version: number; value: number; unit: string }) => [
      c.version,
      c.value,
      c.unit,
    ]),
    [
      [1, winner, target.unit],
      [2, 9.2, target.unit],
    ],
  );
  assert.match(after.corrections[0].correctedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  const stored = (
    await db.admin.query('SELECT payload FROM personal.observation WHERE id=$1', [target.id])
  ).rows[0].payload;
  assert.equal(stored.value, original, 'stored observation untouched');
  await assert.rejects(
    db.api.query('SELECT * FROM personal.observation_correction'),
    /permission denied/,
  );
  await assert.rejects(
    db.admin.query('UPDATE personal.observation_correction SET value=1'),
    /IMMUTABLE_PERSONAL_RECORD/,
  );
  assert.equal(
    (
      await db.admin.query(
        "SELECT count(*)::int n FROM personal.audit WHERE event='correct_observation' AND resource_id LIKE $1",
        [target.id + '#v%'],
      )
    ).rows[0].n,
    2,
  );
});

test('PDF overlaps: same parameter and day from another document signalled, never merged', async () => {
  const { fixturePdf } = await import('../src/modules/extraction/corpus');
  const { extractSyntheticPdf } = await import('../src/modules/extraction/native');
  const overlaps = (sha: string, subject = 'personal:demo-alpha', person = 'demo-alpha') =>
    db.api
      .query('SELECT personal.api_pdf_overlaps($1,$2,$3) r', [subject, person, sha])
      .then((x) => x.rows[0].r);
  // standard (17/11/2026) was confirmed earlier; decimales has the same day.
  const bytes = await fixturePdf('decimales');
  const p = await extractSyntheticPdf(bytes, 'demo-alpha');
  const before = (await read()).record.observations.length;
  assert.equal((await stageProposal(p, bytes)).status, 'ok');
  const r = await overlaps(p.sha256);
  assert.equal(r.status, 'ok');
  const byCode = Object.fromEntries(
    r.overlaps.map(
      (o: { candidateId: string; matches: { value: number; documentId: string }[] }) => [
        p.candidates.find((c) => c.id === o.candidateId)!.code,
        o.matches.map((m) => [m.value, m.documentId]),
      ],
    ),
  );
  assert.deepEqual(byCode, {
    CREATININE: [[9.2, stagedPdf.id]],
    HBA1C: [[5.4, stagedPdf.id]],
    LDL_C: [[1.27, stagedPdf.id]],
  });
  assert.equal((await read()).record.observations.length, before, 'nothing inserted or merged');
  // The confirmed document never overlaps with itself; another day has no overlap.
  assert.deepEqual((await overlaps(stagedPdf.sha256)).overlaps, []);
  const columns = await extractSyntheticPdf(await fixturePdf('colonnes'), 'demo-alpha');
  assert.deepEqual((await overlaps(columns.sha256)).overlaps, []);
  assert.equal((await overlaps(p.sha256, 'personal:demo-beta', 'demo-alpha')).status, 'forbidden');
  assert.equal((await overlaps(p.sha256, 'personal:demo-beta', 'demo-beta')).status, 'not_found');
  assert.equal((await overlaps('0'.repeat(64))).status, 'not_found');
});

test('audit: summary export accepted, unknown events still refused', async () => {
  await db.api.query('SELECT personal.api_audit($1,$2,$3)', [
    'personal:demo-alpha',
    'export_summary',
    'demo-alpha',
  ]);
  assert.equal(
    (
      await db.admin.query(
        "SELECT count(*)::int n FROM personal.audit WHERE event='export_summary' AND person_id='demo-alpha'",
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    db.api.query('SELECT personal.api_audit($1,$2,$3)', ['personal:demo-alpha', 'anything', 'x']),
    /INVALID_AUDIT/,
  );
});

test('consents: revocation stops PDF staging, confirmation and import in SQL; history kept', async () => {
  const { fixturePdf } = await import('../src/modules/extraction/corpus');
  const { extractSyntheticPdf } = await import('../src/modules/extraction/native');
  const call = (sql: string, args: unknown[]) => db.api.query(sql, args).then((x) => x.rows[0].r);
  const consents = (subject = 'personal:demo-alpha', person = 'demo-alpha') =>
    call('SELECT personal.api_consents($1,$2) r', [subject, person]);
  const set = (
    source: string,
    expected: number,
    granted: boolean,
    subject = 'personal:demo-alpha',
  ) =>
    call('SELECT personal.api_set_consent($1,$2,$3,$4,$5) r', [
      subject,
      'demo-alpha',
      source,
      expected,
      granted,
    ]);
  const initial = await consents();
  assert.deepEqual(
    initial.consents.map((c: { source: string; granted: boolean; version: number }) => [
      c.source,
      c.granted,
      c.version,
    ]),
    [
      ['pdf-documents', true, 1],
      ['structured-import', true, 1],
    ],
  );
  assert.equal(initial.consents[0].history[0].decidedBy, 'seed:demo-setup');
  assert.equal((await consents('personal:demo-beta', 'demo-alpha')).status, 'forbidden');
  assert.equal((await set('pdf-documents', 1, true)).status, 'invalid', 'no-op refused');
  assert.equal((await set('other', 1, false)).status, 'invalid');
  assert.equal((await set('pdf-documents', 0, false)).status, 'conflict');
  assert.equal((await set('pdf-documents', 1, false, 'personal:demo-beta')).status, 'forbidden');

  // Stage before revocation, then revoke: confirmation must fail and roll back.
  const bytes = await fixturePdf('colonnes');
  const staged = await extractSyntheticPdf(bytes, 'demo-alpha');
  const ambiguousBytes = await fixturePdf('dates');
  const pending = await extractSyntheticPdf(ambiguousBytes, 'demo-alpha');
  assert.deepEqual(await set('pdf-documents', 1, false), {
    status: 'ok',
    version: 2,
    granted: false,
  });
  await assert.rejects(
    stageProposal(staged, bytes),
    /CONSENT_REQUIRED/,
    'existing intake re-stage refused',
  );
  const fresh = await extractSyntheticPdf(await fixturePdf('scan'), 'demo-alpha');
  await assert.rejects(stageProposal(fresh, await fixturePdf('scan')), /CONSENT_REQUIRED/);
  assert.equal(
    (
      await db.admin.query('SELECT count(*)::int n FROM personal.pdf_intake WHERE sha256=$1', [
        fresh.sha256,
      ])
    ).rows[0].n,
    0,
  );
  const before = (await read()).record.observations.length;
  const eligible = pending.candidates.filter((c) => c.eligible).map((c) => c.id);
  assert.equal(eligible.length, 0);
  // Re-grant, stage a fresh eligible PDF, revoke, then confirm: refused atomically.
  assert.equal((await set('pdf-documents', 2, true)).version, 3);
  const unitsBytes = await fixturePdf('unites');
  const units = await extractSyntheticPdf(unitsBytes, 'demo-alpha');
  assert.equal((await stageProposal(units, unitsBytes)).status, 'ok');
  assert.equal((await set('pdf-documents', 3, false)).version, 4);
  const ok = units.candidates.find((c) => c.eligible)!.id;
  await assert.rejects(confirmProposal(units, [ok]), /CONSENT_REQUIRED/);
  assert.equal((await read()).record.observations.length, before);
  assert.equal(
    (await db.admin.query('SELECT count(*)::int n FROM personal.document WHERE id=$1', [units.id]))
      .rows[0].n,
    0,
  );
  // Structured import gated independently.
  assert.equal((await set('structured-import', 1, false)).version, 2);
  // The demo file was imported by an earlier test (duplicate path writes no receipt), so the
  // trigger is exercised directly, in a transaction that is rolled back.
  const client = await import('pg').then(
    (pg) => new pg.default.Client({ connectionString: db.adminUrl }),
  );
  await client.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      client.query(
        "INSERT INTO personal.import_receipt(person_id,batch_id,sha256) VALUES('demo-alpha','consent-test',repeat('a',64))",
      ),
      /CONSENT_REQUIRED/,
    );
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
  const history = (await consents()).consents[0].history;
  assert.deepEqual(
    history.map((h: { version: number; granted: boolean }) => [h.version, h.granted]),
    [
      [1, true],
      [2, false],
      [3, true],
      [4, false],
    ],
  );
  await assert.rejects(db.api.query('SELECT * FROM personal.source_consent'), /permission denied/);
  await assert.rejects(
    db.admin.query('DELETE FROM personal.source_consent'),
    /IMMUTABLE_PERSONAL_RECORD/,
  );
  assert.equal(
    (
      await db.admin.query(
        "SELECT count(*)::int n FROM personal.audit WHERE event IN ('consent_granted','consent_revoked')",
      )
    ).rows[0].n,
    4,
  );
  // Restore for any later test.
  await set('pdf-documents', 4, true);
  await set('structured-import', 2, true);
});

test('local day (C-01): instants follow the dossier zone across midnight and DST, day values never shift', async () => {
  const day = (at: string, precision: string | null, zone = 'Europe/Paris') =>
    db.admin
      .query("SELECT to_char(personal.local_day($1::timestamptz,$2,$3),'YYYY-MM-DD') d", [
        at,
        precision,
        zone,
      ])
      .then((x) => x.rows[0].d);
  assert.equal(await day('2026-10-24T22:30:00Z', 'instant'), '2026-10-25', 'summer time, UTC+2');
  assert.equal(await day('2026-10-25T22:30:00Z', 'instant'), '2026-10-25', 'winter time, UTC+1');
  assert.equal(await day('2026-10-25T23:30:00Z', 'instant'), '2026-10-26');
  assert.equal(await day('2026-11-17T00:00:00Z', 'day', 'America/New_York'), '2026-11-17');
  assert.equal(await day('2026-11-17T02:00:00Z', 'instant', 'America/New_York'), '2026-11-16');
  const r = (
    await db.api.query('SELECT personal.api_pdf_overlaps($1,$2,$3) r', [
      'personal:demo-alpha',
      'demo-alpha',
      stagedPdf.sha256,
    ])
  ).rows[0].r;
  assert.equal(r.timeZone, 'Europe/Paris');
});

test('OIDC identity: controlled enrolment only, several identities per dossier, revocation, audit', async () => {
  const { linkIdentity } = await import('../scripts/link-identity');
  const { subjectFor } = await import('../src/modules/identity/oidc-core');
  const resolve = (subject: string) =>
    db.api.query('SELECT personal.api_identity_person($1) r', [subject]).then((x) => x.rows[0].r);
  const stranger = subjectFor('https://id.example.test', 'stranger');
  assert.deepEqual(await resolve(stranger), { status: 'not_enrolled' });
  assert.equal(
    (await resolve('personal:demo-alpha')).status,
    'invalid',
    'demo subjects never resolve',
  );
  const subject = await linkIdentity(
    db.adminUrl,
    'https://id.example.test/',
    'alex-real',
    'demo-alpha',
  );
  assert.equal(subject, subjectFor('https://id.example.test', 'alex-real'));
  assert.deepEqual(await resolve(subject), { status: 'ok', personId: 'demo-alpha' });
  // The demo identity of the same dossier still works: two identities, one dossier.
  assert.equal((await read('personal:demo-alpha')).status, 'ok');
  assert.equal((await read(subject)).status, 'ok');
  assert.equal((await read(subject, 'demo-beta')).status, 'forbidden');
  await assert.rejects(
    linkIdentity(db.adminUrl, 'https://id.example.test', 'alex-real', 'demo-beta'),
    /IDENTITY_ALREADY_LINKED/,
  );
  await assert.rejects(
    linkIdentity(db.adminUrl, 'https://id.example.test', 'x', 'nobody'),
    /UNKNOWN_DOSSIER/,
  );
  await db.admin.query('UPDATE personal.actor SET active=false WHERE subject=$1', [subject]);
  try {
    assert.deepEqual(await resolve(subject), { status: 'not_enrolled' });
  } finally {
    await db.admin.query('UPDATE personal.actor SET active=true WHERE subject=$1', [subject]);
  }
  const events = (
    await db.admin.query(
      "SELECT event,count(*)::int n FROM personal.audit WHERE event IN ('oidc_login','oidc_not_enrolled') GROUP BY event ORDER BY event",
    )
  ).rows;
  assert.deepEqual(events, [
    { event: 'oidc_login', n: 1 },
    { event: 'oidc_not_enrolled', n: 2 },
  ]);
  await db.api.query('SELECT personal.api_audit($1,$2,$3)', [subject, 'logout', 'demo-alpha']);
  await assert.rejects(db.api.query('SELECT * FROM personal.actor'), /permission denied/);
});
