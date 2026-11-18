import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractText, getDocumentProxy } from 'unpdf';
import { baseRecord } from '../src/modules/health-records/fixtures';
import { consultationSummary } from '../src/modules/summary/model';
import { consultationSummaryPdf } from '../src/modules/summary/pdf';
import type { HealthRecord } from '../src/modules/health-records/model';

const pdfText = async (bytes: Uint8Array) => {
  const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
  return text.replace(/\s+/g, ' ');
};

test('résumé : sélection par période, sources et lacunes, sans calcul d’évolution', () => {
  const record = baseRecord('demo-alpha');
  const year = consultationSummary(record, 365);
  const all = record.observations.filter(
    (o) => Date.parse(o.measuredAt) >= Date.parse(record.asOf) - 365 * 86400000,
  );
  assert.equal(
    year.markers.reduce((n, m) => n + m.values.length, 0),
    all.length,
  );
  for (const m of year.markers) {
    const dates = m.values.map((v) => v.date);
    assert.deepEqual(dates, dates.toSorted());
    for (const v of m.values) {
      assert.ok(record.documents.some((d) => d.id === v.documentId));
      assert.ok(v.page >= 1);
    }
    assert.deepEqual(Object.keys(m).sort(), [
      'category',
      'code',
      'label',
      'methods',
      'mixedUnits',
      'values',
    ]);
  }
  assert.ok(year.sleep.nights <= year.sleep.days);
  assert.deepEqual(year.sleep.hrvMethods, ['SDNN']);
  const empty = consultationSummary(baseRecord('demo-beta'), 90);
  assert.equal(empty.markers.length, 0);
  assert.equal(empty.missing.length, record.biomarkers.length);
  assert.equal(empty.sleep.meanHours, null);
  assert.throws(() => consultationSummary(record, 0), /INVALID_PERIOD/);
});

test('résumé : correction et unités multiples signalées, jamais converties', () => {
  const record = baseRecord('demo-alpha');
  const [first, second] = record.observations.filter((o) => o.code === 'FERRITIN');
  const patched: HealthRecord = {
    ...record,
    observations: record.observations.map((o) =>
      o.id === first.id
        ? {
            ...o,
            value: o.value + 1,
            corrections: [
              {
                version: 1,
                value: o.value + 1,
                unit: o.unit,
                reason: 'erreur de lecture',
                correctedBy: 'personal:demo-alpha',
                correctedAt: '2026-11-18T13:00:00.000Z',
              },
            ],
          }
        : o.id === second.id
          ? { ...o, unit: 'ng/mL' }
          : o,
    ),
  };
  const s = consultationSummary(patched, 3650);
  const ferritin = s.markers.find((m) => m.code === 'FERRITIN')!;
  assert.equal(ferritin.mixedUnits, true);
  const corrected = ferritin.values.find((v) => v.correction)!;
  assert.deepEqual(corrected.correction, {
    version: 1,
    originalValue: first.evidence.originalValue,
  });
  assert.equal(corrected.value, first.value + 1);
  assert.equal(s.quality.corrected, 1);
});

test('PDF du résumé : texte réel, sources et limites présentes, vocabulaire interprétatif absent', async () => {
  const record = baseRecord('demo-alpha');
  const s = consultationSummary(record, 365);
  const bytes = await consultationSummaryPdf(s, {
    name: 'Alex · profil fictif',
    personId: 'demo-alpha',
  });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  const text = await pdfText(bytes);
  for (const expected of [
    'RÉSUMÉ FACTUEL POUR CONSULTATION',
    'dossier demo-alpha',
    'Ferritine',
    'source : Bilan biologique',
    'page 1',
    'Nuits enregistrées',
    'Mesures du centre : valeurs présentes, avec leur protocole',
    'Tour de taille',
    'Protocole : Mètre ruban',
    'source : Compte rendu de bilan annuel',
    'SDNN',
    'Aucune conversion d',
    'aucun diagnostic, score ni recommandation',
  ])
    assert.ok(text.includes(expected), expected);
  const lowered = text.toLowerCase();
  for (const forbidden of [
    'hausse',
    'baisse',
    'amélior',
    'aggrav',
    'anormal',
    'inquiét',
    'risque',
    'normal ',
    'élevé',
    'faible',
    'à surveiller',
  ])
    assert.ok(!lowered.includes(forbidden), forbidden);
  const empty = await pdfText(
    await consultationSummaryPdf(consultationSummary(baseRecord('demo-beta'), 90), {
      name: 'Camille',
      personId: 'demo-beta',
    }),
  );
  assert.ok(empty.includes('Aucun résultat biologique sur la période.'));
  assert.ok(empty.includes('Aucune mesure sur la période pour'));
});
