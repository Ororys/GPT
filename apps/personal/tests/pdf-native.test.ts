import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePdf, identifyFixture, pdfDigest } from '../src/modules/extraction/corpus';
import {
  collectionDate,
  extractSyntheticPdf,
  reconstructLines,
  selectedObservations,
} from '../src/modules/extraction/native';

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

test('corpus : empreintes des PDF du sprint 03 inchangées (liste blanche des bases existantes)', async () => {
  const expected = {
    standard: 'ff94a0c40aba91ea15ab8b14d101ce79390cfae07078e5e7a56baf5e2829d633',
    decimales: '447674694a6503d14c98539381f47673bd0e558e631432efa818a9d6c8de73eb',
    unites: '626b872229fb2eff31beff63108927e1d13c0576d6e2a5782f64fc08f2f17805',
    scan: 'ef93da7805f920bb6aa50efa19a5caa7cdd01d6e76eec35741cdf1ac6166c109',
    'autre-profil': '00a74babc4ef0190e5af61c876af690d29c7d8704819e5f7269087394cddd998',
  } as const;
  for (const [id, sha] of Object.entries(expected))
    assert.equal(await pdfDigest(await fixturePdf(id as keyof typeof expected)), sha, id);
  for (const id of ['colonnes', 'ambigus', 'dates'] as const)
    assert.equal(await identifyFixture(await fixturePdf(id)), id);
});
test('colonnes : lignes reconstituées par coordonnées, référence unilatérale non structurée', async () => {
  const p = await extractSyntheticPdf(await fixturePdf('colonnes'), 'demo-alpha');
  assert.deepEqual(
    p.candidates.map((c) => [c.code, c.value, c.eligible]),
    [
      ['FERRITIN', 58, true],
      ['VITD', 28, true],
      ['HEMOGLOBIN', 14.1, true],
    ],
  );
  assert.ok(p.candidates.every((c) => c.notes?.includes('ROW_RECONSTRUCTED_FROM_COLUMNS')));
  const vitd = p.candidates.find((c) => c.code === 'VITD')!;
  assert.ok(vitd.notes?.includes('REFERENCE_NOT_STRUCTURED'));
  assert.equal(vitd.observation?.reference, undefined);
  assert.equal(vitd.originalText, 'Vitamine D | 28 | ng/mL | > 20');
  assert.equal(vitd.observation?.evidence.sourceText, vitd.originalText);
  const ferritin = p.candidates[0];
  assert.deepEqual(ferritin.observation?.reference, {
    low: 30,
    high: 300,
    unit: 'µg/L',
    laboratory: 'Laboratoire Boreal - fictif',
  });
  assert.ok(ferritin.bounds.width > 300, 'zone couvrant les quatre colonnes');
  assert.equal(ferritin.observation?.measuredAt, '2026-10-03T00:00:00Z');
  assert.equal(p.document.title, 'Bilan PDF · 3 octobre 2026');
  assert.deepEqual(p.unrecognized, [
    { page: 1, text: 'Glycemie a jeun | 0,92 | g/L | 0,70 - 1,10' },
  ]);
});
test('ambigus : doublon intra-document et signe « < » bloqués, ligne inconnue exposée', async () => {
  const p = await extractSyntheticPdf(await fixturePdf('ambigus'), 'demo-alpha');
  const ferritins = p.candidates.filter((c) => c.code === 'FERRITIN');
  assert.deepEqual(
    ferritins.map((c) => c.value),
    [64, 46],
  );
  assert.ok(
    ferritins.every(
      (c) => !c.eligible && c.observation === null && c.issues.includes('DUPLICATE_IN_DOCUMENT'),
    ),
  );
  const hba1c = p.candidates.find((c) => c.code === 'HBA1C')!;
  assert.equal(hba1c.value, null);
  assert.equal(hba1c.eligible, false);
  assert.deepEqual(hba1c.issues, ['VALUE_QUALIFIER_NOT_SUPPORTED']);
  assert.equal(hba1c.originalText, 'HbA1c | < 4 | % | 4 - 6');
  const eligible = p.candidates.filter((c) => c.eligible);
  assert.deepEqual(
    eligible.map((c) => [c.code, c.value]),
    [['CREATININE', 9]],
  );
  assert.deepEqual(p.unrecognized, [{ page: 1, text: 'Commentaire | voir le laboratoire' }]);
  assert.throws(() => selectedObservations(p, [ferritins[0].id]), /INVALID_SELECTION/);
  assert.throws(() => selectedObservations(p, [hba1c.id]), /INVALID_SELECTION/);
  assert.equal(selectedObservations(p, [eligible[0].id]).length, 1);
});
test('dates : deux prélèvements contradictoires, aucune date choisie ni résultat ajoutable', async () => {
  const p = await extractSyntheticPdf(await fixturePdf('dates'), 'demo-alpha');
  assert.equal(p.pages, 2);
  assert.equal(p.candidates.length, 2);
  assert.ok(
    p.candidates.every(
      (c) =>
        !c.eligible && c.observation === null && c.issues.includes('MEASUREMENT_DATE_AMBIGUOUS'),
    ),
  );
  assert.equal(p.document.title, 'Bilan PDF · date à vérifier');
  assert.match(p.warnings.join(' '), /14 septembre 2026, 21 septembre 2026/);
});
test('date de prélèvement : jour calendaire réel, accord de toutes les occurrences', () => {
  assert.deepEqual(collectionDate('PRELEVEMENT : 17/11/2026'), {
    measuredAt: '2026-11-17T00:00:00Z',
    issue: null,
    found: ['2026-11-17'],
  });
  assert.equal(
    collectionDate('PRELEVEMENT : 17/11/2026\nPRELEVEMENT : 17/11/2026').measuredAt,
    '2026-11-17T00:00:00Z',
  );
  assert.equal(collectionDate('PRELEVEMENT : 31/02/2026').issue, 'MEASUREMENT_DATE_INVALID');
  assert.equal(
    collectionDate('PRELEVEMENT : 17/11/2026\nPRELEVEMENT : 31/02/2026').issue,
    'MEASUREMENT_DATE_INVALID',
  );
  assert.equal(
    collectionDate('PRELEVEMENT : 01/01/2026\nPRELEVEMENT : 02/01/2026').issue,
    'MEASUREMENT_DATE_AMBIGUOUS',
  );
  assert.equal(collectionDate('aucune date').issue, 'MEASUREMENT_DATE_MISSING');
});
test('reconstitution : regroupement par ligne de base, ordre haut-bas puis gauche-droite', () => {
  const item = (str: string, x: number, y: number) => ({ str, x, y, width: 20, height: 10 });
  const lines = reconstructLines([
    [item('64', 230, 600.5), item('Ferritine', 44, 600), item('Titre', 44, 700), item(' ', 9, 9)],
    [item('A | B', 44, 500)],
  ]);
  assert.deepEqual(
    lines.map((l) => [l.page, l.text, l.runs]),
    [
      [1, 'Titre', 1],
      [1, 'Ferritine | 64', 2],
      [2, 'A | B', 1],
    ],
  );
  assert.deepEqual(lines[1].bounds, { x: 44, y: 600, width: 206, height: 10.5 });
});
