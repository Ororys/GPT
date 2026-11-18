import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseRecord } from '../src/modules/health-records/fixtures';
import {
  ObservationSchema,
  PERSON_ALPHA,
  PERSON_BETA,
  DEMO_NOW,
} from '../src/modules/health-records/model';
import {
  activitySummary,
  sleepSummary,
  latest,
  knownAt,
  withinPeriod,
  mean,
} from '../src/modules/observations/selectors';
import { timeline } from '../src/modules/timeline/selectors';
import { ImportSchema, TEMPLATE_TEXT } from '../src/modules/documents/import-contract';
import { authorize, issueSession, verifySession } from '../src/modules/identity/token';

test('jeu synthétique : schémas stricts, patient et unités cohérents', () => {
  const record = baseRecord();
  // 6 laboratory parameters × 6 reports + 6 centre measures × 2 annual reports.
  assert.equal(record.observations.length, 48);
  for (const o of record.observations) {
    assert.ok(ObservationSchema.safeParse(o).success);
    assert.equal(o.personId, record.personId);
    const b = record.biomarkers.find((b) => b.code === o.code);
    assert.equal(o.unit, b?.unit);
    assert.equal(o.value, o.evidence.originalValue);
    assert.equal(o.unit, o.evidence.originalUnit);
    assert.ok(o.measuredAt <= o.knownAt);
    assert.ok(o.knownAt <= DEMO_NOW);
  }
  assert.equal(new Set(record.observations.map((o) => o.id)).size, 48);
});
test('provenance : chaque mesure retrouve son document et le même événement timeline', () => {
  const record = baseRecord();
  const events = timeline(record);
  for (const o of record.observations) {
    const d = record.documents.find((d) => d.id === o.sourceId);
    assert.ok(d);
    assert.equal(o.evidence.documentId, d.id);
    assert.equal(o.measuredAt, d.date);
    assert.ok(o.evidence.page <= d.pages);
    assert.equal(events.find((e) => e.documentId === d.id)?.date, d.date);
  }
});
test('calcul sportif : somme des seules activités filtrées, aucune moyenne fictive', () => {
  const record = baseRecord();
  const s = activitySummary(record, 30);
  assert.ok(s.count > 0);
  assert.ok(s.count < record.activities.length);
  assert.equal(
    s.durationMinutes,
    s.rows.reduce((n, a) => n + a.durationMinutes, 0),
  );
  assert.equal(s.distanceKm, Math.round(s.rows.reduce((n, a) => n + a.distanceKm, 0) * 10) / 10);
  assert.ok(s.rows.every((a) => withinPeriod(a.date, 30)));
  assert.equal(activitySummary(record, 0).count, record.activities.length);
});
test('sommeil : lacunes conservées, moyenne sur les seules mesures disponibles', () => {
  const record = baseRecord();
  assert.ok(record.sleep.length < 90);
  const s = sleepSummary(record, 7);
  const values = record.sleep.filter((s) => withinPeriod(s.date, 7)).map((s) => s.durationHours);
  assert.equal(s.hours, values.reduce((a, b) => a + b, 0) / values.length);
  assert.equal(sleepSummary(baseRecord(PERSON_BETA), 7).hours, null);
  assert.equal(mean([]), null);
});
test('Time Machine : un événement ancien mais connu plus tard reste absent', () => {
  const record = baseRecord();
  const before = knownAt(record, '2026-11-06T23:59:59Z');
  assert.ok(!before.events.some((e) => e.id === 'trip'));
  assert.ok(knownAt(record, '2026-11-08T23:59:59Z').events.some((e) => e.id === 'trip'));
  assert.equal(knownAt(record, '2023-01-01T00:00:00Z').observations.length, 0);
  assert.ok(
    before.observations.every((o) => o.knownAt <= before.asOf && o.measuredAt <= before.asOf),
  );
});
test('dernière valeur indépendante de l’ordre et d’une autre catégorie', () => {
  const record = baseRecord();
  const a = latest(record.observations, 'FERRITIN');
  assert.equal(a?.value, 62);
  assert.equal(a?.sourceId, 'lab-2026-11-04');
  assert.deepEqual(latest(record.observations.toReversed(), 'FERRITIN'), a);
  assert.equal(latest(record.observations, 'INCONNU'), undefined);
});
test('isolation des fixtures : une copie ne modifie jamais une autre et bêta reste vide', () => {
  const a = baseRecord();
  a.observations[0].value = 999;
  assert.notEqual(baseRecord().observations[0].value, 999);
  const b = baseRecord(PERSON_BETA);
  assert.equal(
    b.observations.length +
      b.documents.length +
      b.activities.length +
      b.sleep.length +
      b.events.length,
    0,
  );
});
test('import : contrat synthétique, valeurs originales et provenance conservés', () => {
  const good = ImportSchema.parse(JSON.parse(TEMPLATE_TEXT));
  assert.equal(good.observations[0].value, 63);
  assert.equal(good.observations[0].quality, 'needs-review');
  assert.equal(good.observations[0].evidence.confidence, null);
  assert.equal(ImportSchema.safeParse({ ...good, synthetic: false }).success, false);
  assert.equal(ImportSchema.safeParse({ ...good, personId: PERSON_BETA }).success, false);
  assert.equal(ImportSchema.safeParse({ ...good, arbitrary: 'not allowed' }).success, false);
});
test('session : signature, expiration, sujets connus et refus inter-dossier', () => {
  const secret = 'synthetic-test-only-01234567890123456789';
  const token = issueSession(PERSON_ALPHA, secret, 1000);
  const user = verifySession(token, secret, 1001);
  assert.ok(user);
  assert.equal(user.personId, PERSON_ALPHA);
  assert.equal(verifySession(token, secret, 3_601_001), null);
  assert.equal(verifySession(token + 'x', secret, 1001), null);
  assert.equal(verifySession('malicious', secret), null);
  assert.throws(() => issueSession('admin', secret), /UNKNOWN_PERSONA/);
  assert.throws(() => issueSession(PERSON_ALPHA, 'short'), /SERVER_MISCONFIGURED/);
  assert.throws(() => authorize(user, PERSON_BETA), /FORBIDDEN/);
  assert.throws(() => authorize(null, PERSON_ALPHA), /UNAUTHENTICATED/);
  assert.equal(authorize(user, PERSON_ALPHA).subject, user.subject);
});
test('limites du périmètre : pas de score médical, plages attachées au laboratoire', () => {
  const record = baseRecord();
  assert.ok(
    record.documents.some((d) => d.laboratory.includes('Atlas')) &&
      record.documents.some((d) => d.laboratory.includes('Horizon')),
  );
  for (const o of record.observations) {
    const centre =
      record.biomarkers.find((b) => b.code === o.code)?.category === 'Mesures du centre';
    // Laboratory values carry their lab's range; centre measures carry a protocol, no range.
    if (centre) {
      assert.equal(o.reference, undefined);
      assert.match(o.method, /protocole fictif/);
      assert.ok(o.sourceId.startsWith('report-'));
    } else assert.ok(o.reference?.laboratory.includes('fictif'));
    assert.ok(o.evidence.confidence === null);
  }
  assert.ok(!Object.keys(record).some((k) => /risk|score|diagnos/.test(k)));
});

test('échantillons sportifs : distance intégrée et FC moyenne cohérentes avec le résumé', () => {
  for (const a of baseRecord().activities) {
    assert.ok(a.date <= a.knownAt);
    assert.ok(a.knownAt <= DEMO_NOW);
    assert.ok(Math.abs(a.samples.reduce((n, p) => n + p.speedKmh / 60, 0) - a.distanceKm) < 0.001);
    if (a.avgHeartRate !== null)
      assert.equal(
        a.avgHeartRate,
        Math.round(a.samples.reduce((n, p) => n + p.heartRate, 0) / a.samples.length),
      );
  }
});
test('préparation graphique : 10 000 points, trous non remplacés et index exact', async () => {
  const { prepareChartData } = await import('../src/modules/observations/chart-data');
  const points = Array.from({ length: 10000 }, (_, i) => ({
    date: new Date(1700000000000 + i * 60000).toISOString(),
    value: i % 11 === 0 ? null : i,
  }));
  const result = prepareChartData([{ points }]);
  assert.equal(result.dates.length, 10000);
  assert.equal(result.lookups[0].get(points[11].date)?.value, null);
  assert.equal(result.lookups[0].get(points[14].date)?.value, 14);
});

test('PDF synthétique : une vraie page, empreinte déterministe et métadonnées explicites', async () => {
  const { documentPdf } = await import('../src/modules/documents/pdf');
  const { PDFDocument } = await import('pdf-lib');
  const record = baseRecord();
  const document = record.documents.find((d) => d.id === 'lab-2026-11-04')!;
  const bytes = await documentPdf(record, document);
  assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), '%PDF');
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 1);
  assert.match(parsed.getAuthor() || '', /synthetic/);
  assert.deepEqual(bytes, await documentPdf(record, document));
});
