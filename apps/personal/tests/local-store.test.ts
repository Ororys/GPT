import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValue } from '../src/modules/local/kv';
import { createVault, openVault, hasVault, validCode } from '../src/modules/local/vault';
import { LocalStore, NOTICE_VERSION } from '../src/modules/local/store';
// Few iterations in tests only: the app uses PBKDF2_ITERATIONS.
const FAST = 1_000;
const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4\n${text}\n%%EOF`);
async function fresh() {
  const kv = new MemoryKeyValue();
  const vault = await createVault(kv, '482915', FAST);
  return { kv, store: new LocalStore(vault, () => new Date('2026-11-19T10:00:00Z')) };
}
test('code : 6 à 12 chiffres, jamais stocké, mauvais code refusé', async () => {
  assert.equal(validCode('12345'), false);
  assert.equal(validCode('12345a'), false);
  assert.equal(validCode('123456'), true);
  const kv = new MemoryKeyValue();
  assert.equal(await hasVault(kv), false);
  await createVault(kv, '482915', FAST);
  await assert.rejects(createVault(kv, '111111', FAST), /VAULT_EXISTS/);
  await assert.rejects(openVault(kv, '000000'), /WRONG_CODE/);
  await openVault(kv, '482915');
  assert.ok(!JSON.stringify([...kv.map.values()]).includes('482915'));
});
test('chiffrement : rien de lisible sur le stockage, valeur liée à sa clé', async () => {
  const { kv, store } = await fresh();
  await store.completeOnboarding('Léa');
  await store.setConsent('pdf-documents', 0, true);
  await store.addPdf({
    bytes: pdf('Glycemie secrete'),
    title: 'Bilan de mars',
    kind: 'biology',
    date: '2026-03-02',
    pages: 1,
  });
  const raw = [...kv.map.values()].map((v) =>
    JSON.stringify(v, (_k, x) =>
      x instanceof Uint8Array ? new TextDecoder('latin1').decode(x) : x,
    ),
  );
  for (const secret of ['Léa', 'Bilan de mars', 'Glycemie secrete'])
    assert.ok(!raw.some((r) => r.includes(secret)), secret);
  // Moving an encrypted value under another name is detected (authenticated key).
  const names = [...kv.map.keys()].join(' ');
  assert.match(
    names,
    /^(vault|onboarding|consent\/pdf-documents|doc\/pdf-[0-9a-f-]{36}|pdf\/pdf-[0-9a-f-]{36})( |$)/,
  );
  assert.doesNotMatch(names, /[0-9a-f]{64}/, 'aucune empreinte en clair');
  kv.map.set('onboarding', kv.map.get('consent/pdf-documents'));
  await assert.rejects(store.onboarding());
});
test('premier lancement : majorité déclarée et version du texte d’information conservées', async () => {
  const { store } = await fresh();
  const o = await store.completeOnboarding('  Léa  ');
  assert.deepEqual(o, {
    adultDeclared: true,
    noticeVersion: NOTICE_VERSION,
    acceptedAt: '2026-11-19T10:00:00.000Z',
    firstName: 'Léa',
  });
  const record = await store.record();
  assert.equal(record.synthetic, false);
  assert.equal(record.storage, 'device');
  assert.equal(record.profile.initials, 'L');
});
test('autorisations : refusées par défaut, versionnées, conflit détecté', async () => {
  const { store } = await fresh();
  assert.deepEqual(
    (await store.consents()).map((c) => [c.source, c.granted, c.version]),
    [
      ['device-health', false, 0],
      ['pdf-documents', false, 0],
    ],
  );
  await assert.rejects(
    store.addPdf({ bytes: pdf('x'), title: 'A', kind: 'report', date: '2026-01-01', pages: 1 }),
    /CONSENT_REQUIRED/,
  );
  await store.setConsent('pdf-documents', 0, true);
  await assert.rejects(store.setConsent('pdf-documents', 0, false), /CONSENT_CONFLICT/);
  const c = (await store.consents()).find((x) => x.source === 'pdf-documents')!;
  assert.equal(c.version, 1);
  assert.equal(c.history[0]!.decidedBy, 'vous');
});
test('PDF : octets conservés à l’identique, doublon reconnu, non-PDF et date invalide refusés', async () => {
  const { store } = await fresh();
  await store.setConsent('pdf-documents', 0, true);
  const bytes = pdf('contenu');
  const input = {
    bytes,
    title: 'Compte rendu',
    kind: 'report' as const,
    date: '2026-02-10',
    pages: 2,
  };
  const first = await store.addPdf(input);
  assert.equal(first.duplicate, false);
  assert.deepEqual(await store.pdfBytes(first.document.id), bytes);
  assert.equal((await store.addPdf({ ...input, title: 'Autre nom' })).duplicate, true);
  await assert.rejects(
    store.addPdf({ ...input, bytes: new TextEncoder().encode('<html>') }),
    /INVALID_PDF/,
  );
  await assert.rejects(
    store.addPdf({ ...input, bytes: pdf('y'), date: '10/02/2026' }),
    /INVALID_DATE/,
  );
  const record = await store.record();
  assert.equal(record.documents.length, 1);
  assert.equal(record.documents[0]!.date, '2026-02-10T00:00:00Z');
  assert.equal(record.documents[0]!.datePrecision, 'day');
  assert.equal(record.documents[0]!.laboratory, 'Origine non renseignée');
  assert.equal(record.observations.length, 0, 'aucune valeur lue automatiquement');
});
const phone = (value: number, day: string) => ({
  platform: 'health-connect',
  samples: [
    {
      dataType: 'steps',
      value,
      unit: 'count',
      startDate: `${day}T00:00:00+01:00`,
      endDate: `${day}T23:59:59+01:00`,
      aggregation: 'daily-total',
    },
  ],
});
test('téléphone : autorisation exigée, import idempotent, totaux quotidiens', async () => {
  const { store } = await fresh();
  await assert.rejects(store.importDevice(phone(8000, '2026-11-17')), /CONSENT_REQUIRED/);
  await store.setConsent('device-health', 0, true);
  assert.deepEqual(await store.importDevice(phone(8000, '2026-11-17')), {
    inserted: 1,
    duplicates: 0,
  });
  assert.deepEqual(await store.importDevice(phone(8000, '2026-11-17')), {
    inserted: 0,
    duplicates: 1,
  });
  await assert.rejects(
    store.importDevice({ platform: 'health-connect', samples: [] }),
    /INVALID_DEVICE_DATA/,
  );
  await assert.rejects(store.importDevice(phone(10, '2026-12-25')), /INVALID_DEVICE_DATA/);
  assert.deepEqual((await store.record()).device?.steps, [{ day: '2026-11-17', value: 8000 }]);
});
test('retrait : arrêter garde les données, arrêter et effacer les supprime (art. 17)', async () => {
  const { store } = await fresh();
  await store.setConsent('device-health', 0, true);
  await store.importDevice(phone(8000, '2026-11-17'));
  await store.setConsent('device-health', 1, false);
  assert.equal((await store.deviceRows()).length, 1);
  await assert.rejects(store.importDevice(phone(9000, '2026-11-18')), /CONSENT_REQUIRED/);
  await store.setConsent('device-health', 2, true);
  await store.setConsent('device-health', 3, false, true);
  assert.equal((await store.deviceRows()).length, 0);
  assert.equal((await store.record()).device, null);
});
test('suppression d’un document, export complet, puis suppression totale', async () => {
  const { kv, store } = await fresh();
  await store.completeOnboarding('Léa');
  await store.setConsent('pdf-documents', 0, true);
  const a = await store.addPdf({
    bytes: pdf('a'),
    title: 'A',
    kind: 'report',
    date: '2026-01-01',
    pages: 1,
  });
  await store.addPdf({
    bytes: pdf('b'),
    title: 'B',
    kind: 'biology',
    date: '2026-01-02',
    pages: 1,
  });
  await store.deleteDocument(a.document.id);
  await assert.rejects(store.pdfBytes(a.document.id), /NOT_FOUND/);
  const exported = await store.exportAll();
  assert.equal(exported.documents.length, 1);
  assert.equal(atob(exported.documents[0]!.pdfBase64).includes('%PDF-'), true);
  assert.equal(exported.onboarding?.noticeVersion, NOTICE_VERSION);
  assert.equal(exported.consents.length, 2);
  await store.deleteAll();
  assert.equal(kv.map.size, 0, 'rien ne reste, pas même la clé');
  assert.equal(await hasVault(kv), false);
});
