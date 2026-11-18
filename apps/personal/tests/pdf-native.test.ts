import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePdf, identifyFixture, pdfDigest } from '../src/modules/extraction/corpus';
import { extractSyntheticPdf, selectedObservations } from '../src/modules/extraction/native';

test('PDF natif : six valeurs extraites, page, texte, coordonnées et absence de confiance inventée', async () => {
  const bytes = await fixturePdf('standard');
  const proposal = await extractSyntheticPdf(bytes, 'demo-alpha');
  assert.equal(proposal.candidates.length, 6);
  assert.equal(proposal.datePrecision, 'day');
  assert.ok(
    proposal.candidates.every(
      (c) =>
        c.observation?.measuredPrecision === 'day' &&
        c.observation?.method === 'lab_method_not_reported',
    ),
  );
  assert.deepEqual(
    proposal.candidates.map((c) => [c.code, c.value]),
    [
      ['FERRITIN', 64],
      ['LDL_C', 1.27],
      ['HBA1C', 5.4],
      ['CREATININE', 9.2],
      ['VITD', 35],
      ['HEMOGLOBIN', 14.6],
    ],
  );
  assert.ok(
    proposal.candidates.every(
      (c) => c.page === 1 && c.bounds.width > 0 && c.originalText.includes('|'),
    ),
  );
  assert.ok(proposal.candidates.every((c) => c.observation?.evidence.confidence === null));
  assert.equal(proposal.sha256, await pdfDigest(bytes));
});
test('deux pages et virgules françaises : attribution de page et dates exactes', async () => {
  const p = await extractSyntheticPdf(await fixturePdf('decimales'), 'demo-alpha');
  assert.equal(p.pages, 2);
  assert.deepEqual(
    p.candidates.map((c) => [c.value, c.page]),
    [
      [1.26, 1],
      [9.1, 1],
      [5.3, 2],
    ],
  );
  assert.ok(p.candidates.every((c) => c.observation?.measuredAt === '2026-11-17T00:00:00Z'));
});
test('unités : seulement équivalence typographique micro, aucune conversion mmol/L', async () => {
  const p = await extractSyntheticPdf(await fixturePdf('unites'), 'demo-alpha');
  const ldl = p.candidates.find((c) => c.code === 'LDL_C')!;
  assert.equal(ldl.eligible, false);
  assert.ok(ldl.issues.includes('UNIT_MISMATCH_NO_CONVERSION'));
  assert.equal(ldl.observation, null);
  const ferritin = p.candidates.find((c) => c.code === 'FERRITIN')!;
  assert.equal(ferritin.eligible, true);
  assert.equal(ferritin.observation?.unit, 'µg/L');
  assert.equal(ferritin.observation?.evidence.originalUnit, 'μg/L');
});
test('sans texte : OCR requis, aucun résultat inventé', async () => {
  const p = await extractSyntheticPdf(await fixturePdf('scan'), 'demo-alpha');
  assert.equal(p.status, 'ocr-required');
  assert.deepEqual(p.candidates, []);
  assert.ok(p.warnings.length > 0);
});
test('sécurité : empreinte, taille, faux PDF et autre dossier', async () => {
  await assert.rejects(identifyFixture(new Uint8Array(500001)), /PAYLOAD_TOO_LARGE/);
  await assert.rejects(identifyFixture(new TextEncoder().encode('not PDF')), /INVALID_PDF/);
  const bytes = await fixturePdf('standard');
  bytes[50] ^= 1;
  await assert.rejects(identifyFixture(bytes), /INVALID_DEMO_PDF/);
  await assert.rejects(
    extractSyntheticPdf(await fixturePdf('autre-profil'), 'demo-alpha'),
    /FORBIDDEN/,
  );
  await assert.rejects(extractSyntheticPdf(await fixturePdf('standard'), 'demo-beta'), /FORBIDDEN/);
});
test('revue : aucune observation sans sélection explicite, uniquement candidats compatibles', async () => {
  const p = await extractSyntheticPdf(await fixturePdf('unites'), 'demo-alpha');
  assert.throws(() => selectedObservations(p, []), /INVALID_SELECTION/);
  assert.throws(() => selectedObservations(p, [p.candidates[0].id]), /INVALID_SELECTION/);
  assert.throws(() => selectedObservations(p, ['forged']), /INVALID_SELECTION/);
  const good = selectedObservations(p, [p.candidates[1].id]);
  assert.equal(good.length, 1);
  assert.equal(good[0].quality, 'needs-review');
  assert.equal(good[0].evidence.method, 'native-pdf');
});

test('upload Node : empreinte limitée à la vue Buffer, sans octets voisins ni mutation', async () => {
  const bytes = await fixturePdf('standard');
  const backing = Buffer.allocUnsafe(bytes.length + 128);
  backing.fill(123);
  Buffer.from(bytes).copy(backing, 64);
  const view = backing.subarray(64, 64 + bytes.length);
  assert.equal(await pdfDigest(view), await pdfDigest(bytes));
  assert.equal(await identifyFixture(view), 'standard');
  const p = await extractSyntheticPdf(view, 'demo-alpha');
  assert.equal(p.candidates.length, 6);
  assert.deepEqual(new Uint8Array(view), bytes);
});
