import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiCandidates, seriesCode } from '../src/modules/ai/candidates';
import { AiReadingSchema, AI_JSON_SCHEMA, AI_INSTRUCTIONS } from '../src/modules/ai/contract';
import { biomarkers } from '../src/modules/health-records/fixtures';
import { MemoryKeyValue } from '../src/modules/local/kv';
import { createVault } from '../src/modules/local/vault';
import { LocalStore } from '../src/modules/local/store';
const line = (over: Record<string, unknown>) => ({
  label: 'Glycémie à jeun',
  value: '5,2',
  unit: 'mmol/L',
  referenceText: '3,9 - 5,5',
  page: 1,
  catalogCode: 'NONE',
  category: 'Glycémie',
  ...over,
});
const reading = (...results: Record<string, unknown>[]) =>
  AiReadingSchema.parse({ printedDate: null, laboratory: null, results });
test('contrat : transcription seulement, aucun champ d’interprétation possible', () => {
  const fields = Object.keys(AI_JSON_SCHEMA.properties.results.items.properties);
  assert.deepEqual(fields, [
    'label',
    'value',
    'unit',
    'referenceText',
    'page',
    'catalogCode',
    'category',
  ]);
  assert.equal(AI_JSON_SCHEMA.properties.results.items.additionalProperties, false);
  assert.match(AI_INSTRUCTIONS, /aucune indication normal\/anormal/);
  assert.throws(() => reading(line({ flag: 'H' })));
});
test('valeurs : nombres stricts, « < » et texte bloqués, unité d’origine conservée', () => {
  const list = aiCandidates(
    reading(
      line({}),
      line({ label: 'CRP', value: '< 0,5', unit: 'mg/L', category: 'Inflammation' }),
      line({
        label: 'Plaquettes',
        value: '250 000',
        unit: '/mm3',
        referenceText: null,
        category: 'Hématologie',
      }),
      line({ label: 'Aspect', value: 'clair', unit: null, category: 'Urines' }),
      line({
        label: 'Ferritine',
        value: '80',
        unit: 'μg/L',
        referenceText: '30 - 300',
        catalogCode: 'FERRITIN',
        category: 'Statut martial',
      }),
    ),
    biomarkers,
    'Laboratoire de test',
  );
  const [glucose, crp, platelets, aspect, ferritin] = list;
  assert.equal(glucose!.value, 5.2);
  assert.equal(glucose!.code, seriesCode('Glycémie à jeun', 'mmol/L'));
  assert.deepEqual(glucose!.reference, {
    low: 3.9,
    high: 5.5,
    laboratory: 'Laboratoire de test',
    unit: 'mmol/L',
  });
  assert.equal(glucose!.newBiomarker?.category, 'Glycémie');
  assert.equal(crp!.blocked, 'not-a-number');
  assert.equal(platelets!.value, 250000);
  assert.equal(platelets!.reference, undefined);
  assert.equal(aspect!.blocked, 'not-a-number');
  // Catalog parameter: µ/μ harmonised, printed unit kept.
  assert.equal(ferritin!.code, 'FERRITIN');
  assert.equal(ferritin!.unit, 'µg/L');
  assert.equal(ferritin!.originalUnit, 'μg/L');
  assert.equal(ferritin!.blocked, null);
  assert.equal(ferritin!.newBiomarker, undefined);
});
test('blocages : unité différente du catalogue, unité absente, paramètre en double', () => {
  const list = aiCandidates(
    reading(
      line({ label: 'Créatinine', value: '0,9', unit: 'mg/dL', catalogCode: 'CREATININE' }),
      line({ label: 'Sodium', value: '140', unit: null }),
      line({ label: 'Potassium', value: '4,1', unit: 'mmol/L' }),
      line({ label: 'Potassium', value: '4,3', unit: 'mmol/L', page: 2 }),
    ),
    biomarkers,
    'Lab',
  );
  assert.deepEqual(
    list.map((c) => c.blocked),
    ['unit-mismatch', 'no-unit', 'duplicate', 'duplicate'],
  );
});
test('ajout : seulement les lignes choisies, « à vérifier », série créée, effacement par source', async () => {
  const kv = new MemoryKeyValue();
  const store = new LocalStore(
    await createVault(kv, '482915', 1_000),
    () => new Date('2026-11-19T10:00:00Z'),
  );
  await store.setConsent('pdf-documents', 0, true);
  const { document } = await store.addPdf({
    bytes: new TextEncoder().encode('%PDF-1.4 x'),
    title: 'Bilan',
    kind: 'biology',
    date: '2026-03-02',
    pages: 1,
  });
  const candidates = aiCandidates(
    reading(
      line({}),
      line({ label: 'CRP', value: '< 0,5', unit: 'mg/L' }),
      line({ label: 'Urée', value: '5', unit: 'mmol/L' }),
    ),
    biomarkers,
    'Lab',
  );
  const input = { documentId: document.id, candidates, selected: ['ai-0'], model: 'm' };
  await assert.rejects(store.addAiObservations(input), /CONSENT_REQUIRED/);
  await store.setConsent('ai-reading', 0, true);
  await assert.rejects(
    store.addAiObservations({ ...input, selected: ['ai-1'] }),
    /INVALID_SELECTION/,
  );
  assert.deepEqual(await store.addAiObservations(input), { inserted: 1, duplicates: 0 });
  assert.deepEqual(await store.addAiObservations(input), { inserted: 0, duplicates: 1 });
  const record = await store.record();
  assert.equal(record.observations.length, 1);
  const o = record.observations[0]!;
  assert.equal(o.value, 5.2);
  assert.equal(o.measuredAt, '2026-03-02T00:00:00Z');
  assert.equal(o.measuredPrecision, 'day');
  assert.equal(o.quality, 'needs-review');
  assert.equal(o.evidence.method, 'ai-transcription');
  assert.equal(o.evidence.confidence, null);
  assert.equal(o.method, 'lab_method_not_reported');
  assert.equal(o.synthetic, false);
  // The new series exists only while it has values; « Urée » was not chosen.
  assert.deepEqual(
    record.biomarkers.filter((b) => b.code.startsWith('USR_')).map((b) => b.label),
    ['Glycémie à jeun'],
  );
  await store.setConsent('ai-reading', 1, false, true);
  const after = await store.record();
  assert.equal(after.observations.length, 0);
  assert.equal(after.documents.length, 1, 'le PDF reste rangé');
});
test('supprimer le document supprime aussi ses valeurs', async () => {
  const store = new LocalStore(await createVault(new MemoryKeyValue(), '482915', 1_000));
  await store.setConsent('pdf-documents', 0, true);
  await store.setConsent('ai-reading', 0, true);
  const { document } = await store.addPdf({
    bytes: new TextEncoder().encode('%PDF-1.4 y'),
    title: 'Bilan',
    kind: 'biology',
    date: '2026-03-02',
    pages: 1,
  });
  const candidates = aiCandidates(reading(line({})), biomarkers, 'Lab');
  await store.addAiObservations({
    documentId: document.id,
    candidates,
    selected: ['ai-0'],
    model: 'm',
  });
  await store.deleteDocument(document.id);
  assert.equal((await store.record()).observations.length, 0);
});
