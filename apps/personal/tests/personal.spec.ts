import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { TEMPLATE_TEXT } from '../src/modules/documents/import-contract';
const shots = 'test-results/screenshots';
async function open(page: import('@playwright/test').Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('.loading-page')).toHaveCount(0);
  await expect(page.locator('.empty-state[role=alert]')).toHaveCount(0);
  await expect(page.locator('.sidebar-profile strong')).toContainText('Alex');
}

test('overview réel : données, graphique interactif, comparaison, tableau accessible et capture desktop', async ({
  page,
}) => {
  await mkdir(shots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(page.getByRole('heading', { name: 'Votre santé, en perspective.' })).toBeVisible();
  await expect(page.locator('.trend-panel canvas')).toBeVisible();
  await page.locator('.compare-toggle input').check();
  await expect(page.locator('.trend-panel .chart-legend')).toContainText('Durée du sommeil');
  await page
    .locator('.trend-panel')
    .getByRole('button', { name: 'Afficher les données en tableau' })
    .click();
  await expect(page.locator('.trend-panel table')).toBeVisible();
  await expect(page.locator('.trend-panel table tbody tr')).toHaveCount(90);
  await page.locator('.trend-panel').getByRole('button', { name: 'Afficher le graphique' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${shots}/01-overview-dark-desktop.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('navigation : cinq pages, routes réelles, mode clair persistant et rétractation', async ({
  page,
}) => {
  await open(page);
  for (const [route, title] of [
    ['/biology', 'Vos bilans, au fil du temps.'],
    ['/sport', 'Le mouvement, dans la durée.'],
    ['/documents', 'Tout commence à la source.'],
    ['/timeline', 'Le fil de votre histoire.'],
  ]) {
    await page.locator(`.sidebar a[href="${route}"]`).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('.loading-page')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Activer le mode clair' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Rétracter la navigation' }).click();
  await expect(page.locator('.app-shell')).toHaveClass(/collapsed/);
  await page.getByRole('button', { name: 'Déployer la navigation' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${shots}/02-timeline-light-desktop.png`, fullPage: true });
});

test('biologie : filtre, mesure cohérente, provenance et vrai PDF', async ({ page }) => {
  await open(page, '/biology');
  await page.getByRole('textbox', { name: 'Rechercher un biomarqueur' }).fill('LDL');
  await expect(page.locator('.biomarker-option')).toHaveCount(1);
  await page.locator('.biomarker-option').click();
  await expect(page.locator('.large-value')).toContainText('1,28');
  await page.getByRole('checkbox', { name: /Comparer au LDL/ }).check();
  await page.getByRole('button', { name: 'Bilan source' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.selected-evidence')).toContainText('1.28');
  const href = await page.getByRole('link', { name: /Ouvrir le PDF/ }).getAttribute('href');
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF');
  expect(response.headers()['x-document-sha256']).toMatch(/^[a-f0-9]{64}$/);
  await page.screenshot({ path: `${shots}/03-evidence-desktop.png`, fullPage: true });
});

test('sport : filtres, tri, période et analyse synchronisée', async ({ page }) => {
  await open(page, '/sport');
  await page.getByRole('button', { name: '30 jours', exact: true }).click();
  await page.getByRole('button', { name: 'Vélo', exact: true }).click();
  await expect(page.locator('tbody tr')).not.toHaveCount(0);
  const names = await page.locator('.sport-table-label').allTextContents();
  expect(names.every((s) => s.includes('vélo'))).toBe(true);
  await page.getByRole('combobox', { name: 'Trier les activités' }).selectOption('distance');
  await page.locator('tbody .icon-button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('canvas')).toBeVisible();
  await page.screenshot({ path: `${shots}/04-activity-desktop.png`, fullPage: true });
});

test('documents : recherche, états vides et source reliée', async ({ page }) => {
  await open(page, '/documents');
  await page.getByRole('button', { name: 'Tout', exact: true }).click();
  await page.getByRole('textbox', { name: 'Rechercher un document' }).fill('novembre');
  await expect(page.locator('.document-card')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Rechercher un document' }).fill('introuvable');
  await expect(page.getByRole('heading', { name: 'Aucun document ne correspond' })).toBeVisible();
  await page.getByRole('button', { name: 'Effacer les filtres' }).click();
  await page.getByRole('combobox', { name: 'Statut du document' }).selectOption('error');
  await expect(page.locator('.document-card')).toHaveCount(0);
});

test('Time Machine : événement et date de connaissance distincts', async ({ page }) => {
  await open(page, '/timeline');
  await page.getByRole('button', { name: 'Ouvrir la Time Machine' }).click();
  await page.getByRole('button', { name: 'Événements de vie', exact: true }).click();
  await page.locator('input[type=date]').fill('2026-11-06');
  await expect(page.getByRole('heading', { name: 'Quelques jours en montagne' })).toHaveCount(0);
  await page.locator('input[type=date]').fill('2026-11-08');
  await expect(page.getByRole('heading', { name: 'Quelques jours en montagne' })).toBeVisible();
});

test('import : fichier refusé, import atomique, idempotence et cohérence des pages', async ({
  page,
}) => {
  await open(page, '/documents');
  await page
    .locator('.documents-hero')
    .getByRole('button', { name: 'Importer une démo', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Import JSON', exact: true }).click();
  await dialog.getByLabel('Fichier de démonstration').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"synthetic":true}'),
  });
  await dialog.getByRole('button', { name: 'Vérifier et importer' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Seul le fichier synthétique fourni');
  await dialog.getByLabel('Fichier de démonstration').setInputFiles({
    name: 'demo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(TEMPLATE_TEXT),
  });
  await dialog.getByRole('button', { name: 'Vérifier et importer' }).click();
  await expect(dialog.getByRole('status')).toContainText('1 résultat importé');
  await dialog.getByRole('button', { name: 'Vérifier et importer' }).click();
  await expect(dialog.getByRole('status')).toContainText('Aucun doublon');
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await page.locator('.sidebar a[href="/biology"]').click();
  await expect(page.locator('.large-value')).toContainText('63');
  await page.locator('.sidebar a[href="/timeline"]').click();
  await expect(
    page.getByRole('heading', { name: 'Bilan biologique · novembre 2026 (import)' }),
  ).toBeVisible();
});

test('sécurité HTTP : sans session, accès croisé, CSRF, taille et fichier modifié', async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3100' });
  expect((await api.get('/api/records/demo-alpha')).status()).toBe(401);
  expect((await api.post('/api/session', { data: { personId: 'demo-alpha' } })).status()).toBe(403);
  expect(
    (
      await api.post('/api/session', {
        headers: { origin: 'http://127.0.0.1:3100' },
        data: { personId: 'demo-alpha' },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await api.post('/api/session', {
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        data: '{',
      })
    ).status(),
  ).toBe(422);
  expect((await api.get('/', { headers: { host: 'evil.invalid' } })).status()).toBe(421);
  expect((await api.get('/api/records/demo-beta')).status()).toBe(403);
  const stored = await (await api.get('/api/records/demo-alpha')).json();
  expect(stored.storage).toBe(
    process.env.HC_PERSONAL_E2E_STORAGE === 'postgres'
      ? 'postgresql'
      : 'synthetic-fixture+local-imports',
  );
  expect(
    (
      await api.post('/api/imports', {
        headers: { origin: 'https://evil.invalid', 'content-type': 'application/json' },
        data: TEMPLATE_TEXT,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await api.post('/api/imports', {
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        data: 'x'.repeat(100001),
      })
    ).status(),
  ).toBe(413);
  expect(
    (
      await api.post('/api/imports', {
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        data: TEMPLATE_TEXT.replace('63', '999'),
      })
    ).status(),
  ).toBe(422);
  const beta = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3100' });
  await beta.post('/api/session', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: { personId: 'demo-beta' },
  });
  expect((await beta.get('/api/documents/lab-2026-11-04')).status()).toBe(404);
  await api.dispose();
  await beta.dispose();
});

test('profil vide, paramètres et export contrôlé', async ({ page }) => {
  await open(page, '/settings');
  if (process.env.HC_PERSONAL_E2E_STORAGE === 'postgres') {
    await expect(page.getByText('PostgreSQL connecté', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${shots}/08-postgresql-settings.png`, fullPage: true });
  }
  await page.getByRole('button', { name: /Camille Durand/ }).click();
  await expect(page.locator('.sidebar-profile strong')).toContainText('Camille');
  const response = await page.request.get('/api/export');
  expect(response.status()).toBe(200);
  expect((await response.json()).observations).toEqual([]);
  await page.locator('.sidebar nav a[href="/"]').click();
  await expect(
    page.getByRole('heading', { name: /Bienvenue dans votre espace, Camille/ }),
  ).toBeVisible();
});

test('mobile : cinq parcours, clair/sombre, sans débordement à 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  for (const path of ['/', '/biology', '/sport', '/documents', '/timeline']) {
    await page.locator(`.mobile-nav a[href="${path}"]`).click();
    await page.waitForURL(path === '/' ? 'http://127.0.0.1:3100/' : `**${path}`);
    await expect(page.locator('.loading-page')).toHaveCount(0);
    await expect(page.locator('.panel,.timeline-feed').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await expect(page.locator('.mobile-nav')).toBeVisible();
  }
  await page.locator('.mobile-nav a[href="/"]').click();
  await expect(page.locator('.metric-grid')).toBeVisible();
  await expect(page.locator('.trend-panel canvas')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${shots}/05-overview-dark-mobile.png`, fullPage: false });
  await page.getByRole('button', { name: 'Activer le mode clair' }).click();
  await page.screenshot({ path: `${shots}/06-overview-light-mobile.png`, fullPage: false });
});

test('accessibilité : audit automatisé ciblé AA, sombre et clair, clavier et réduction du mouvement', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
  for (const mode of ['dark', 'light']) {
    if (mode === 'light') await page.getByRole('button', { name: 'Activer le mode clair' }).click();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});

test('graphique 10 000 points : rendu, zoom et tableau paginé avec lacunes', async ({ page }) => {
  await page.goto('/lab/chart');
  await expect(page.getByRole('heading', { name: /10 000 points/ })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('canvas').hover({ position: { x: 300, y: 160 } });
  await page.mouse.wheel(0, -200);
  await page.getByRole('button', { name: 'Afficher les données en tableau' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(250);
  await page.getByRole('button', { name: /Afficher 250 points supplémentaires/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(500);
  await page.getByRole('button', { name: 'Afficher le graphique' }).click();
  await page.screenshot({ path: `${shots}/07-chart-10000.png`, fullPage: true });
});

test('PDF natif : lecture réelle, revue explicite, ajout sourcé et aucun doublon', async ({
  page,
}) => {
  test.skip(
    process.env.HC_PERSONAL_E2E_STORAGE !== 'postgres',
    'PDF staging requires PostgreSQL; local-file mode is explicitly unsupported',
  );
  await open(page, '/documents');
  const before = await (await page.request.get('/api/records/demo-alpha')).json();
  await page
    .locator('.documents-hero')
    .getByRole('button', { name: 'Importer une démo', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('tab', { name: 'PDF biologique' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Essayer ce PDF' }).click();
  await expect(dialog.locator('.pdf-candidate')).toHaveCount(6);
  await expect(
    dialog.getByRole('checkbox', { name: 'Ajouter Ferritine', exact: true }),
  ).toBeChecked();
  const staged = await (await page.request.get('/api/records/demo-alpha')).json();
  expect(staged.observations.length).toBe(before.observations.length);
  await dialog
    .locator('.pdf-candidate')
    .first()
    .getByText('Voir le texte source et la provenance')
    .click();
  await expect(dialog.locator('.source-quote').first()).toContainText('Ferritine');
  await page.screenshot({ path: `${shots}/09-pdf-review.png`, fullPage: true });
  await dialog.getByRole('button', { name: 'Ajouter 6 résultat(s) sélectionné(s)' }).click();
  await expect(dialog.getByText(/6 résultat\(s\) ajouté\(s\)/)).toBeVisible();
  const after = await (await page.request.get('/api/records/demo-alpha')).json();
  expect(after.observations.length).toBe(before.observations.length + 6);
  const source = after.documents.find((d: { id: string }) => d.id.startsWith('pdf-'));
  expect(source).toBeTruthy();
  const pdf = await page.request.get('/api/documents/' + source.id);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['x-document-sha256']).toBe(source.id.slice(4));
  await dialog.getByRole('button', { name: 'Essayer ce PDF' }).click();
  await expect(
    dialog.getByText('Ce document a déjà été ajouté. Aucun doublon ne sera créé.'),
  ).toBeVisible();
  expect(
    (await (await page.request.get('/api/records/demo-alpha')).json()).observations.length,
  ).toBe(after.observations.length);
});

test('PDF limites : unité incompatible bloquée et absence de texte signalée sans OCR', async ({
  page,
}) => {
  test.skip(process.env.HC_PERSONAL_E2E_STORAGE !== 'postgres', 'PDF staging requires PostgreSQL');
  await open(page, '/documents');
  await page
    .locator('.documents-hero')
    .getByRole('button', { name: 'Importer une démo', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Exemple PDF' }).selectOption('unites');
  await dialog.getByRole('button', { name: 'Essayer ce PDF' }).click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Ajouter LDL-cholestérol', exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole('checkbox', { name: 'Ajouter Ferritine', exact: true }),
  ).toBeEnabled();
  await dialog.getByRole('combobox', { name: 'Exemple PDF' }).selectOption('scan');
  await dialog.getByRole('button', { name: 'Essayer ce PDF' }).click();
  await expect(dialog.getByText('OCR nécessaire', { exact: true })).toBeVisible();
  await expect(dialog.locator('.pdf-candidate')).toHaveCount(0);
  await expect(dialog.getByText(/Aucun résultat n’a été inventé/)).toBeVisible();
});

test('PDF ambigus : motifs de blocage explicites, lignes non reprises visibles, seul le résultat net est ajoutable', async ({
  page,
}) => {
  test.skip(process.env.HC_PERSONAL_E2E_STORAGE !== 'postgres', 'PDF staging requires PostgreSQL');
  await open(page, '/documents');
  await page
    .locator('.documents-hero')
    .getByRole('button', { name: 'Importer une démo', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Exemple PDF' }).selectOption('ambigus');
  await dialog.getByRole('button', { name: 'Essayer ce PDF' }).click();
  await expect(dialog.locator('.pdf-candidate')).toHaveCount(4);
  await expect(dialog.getByText(/paramètre présent plusieurs fois/)).toHaveCount(2);
  await expect(dialog.getByText(/valeur précédée d’un signe, non interprétée/)).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Ajouter HbA1c', exact: true })).toBeDisabled();
  await expect(
    dialog.getByRole('checkbox', { name: 'Ajouter Créatinine', exact: true }),
  ).toBeChecked();
  await dialog.getByText('1 ligne(s) lue(s) mais non reprise(s)').click();
  await expect(dialog.getByText('Page 1 · Commentaire | voir le laboratoire')).toBeVisible();
  await page.screenshot({ path: `${shots}/10-pdf-ambigus.png`, fullPage: true });
  await expect(
    dialog.getByRole('button', { name: 'Ajouter 1 résultat(s) sélectionné(s)' }),
  ).toBeEnabled();

  await dialog.getByRole('combobox', { name: 'Exemple PDF' }).selectOption('dates');
  await dialog.getByRole('button', { name: 'Essayer ce PDF' }).click();
  await expect(dialog.getByText(/Plusieurs dates de prélèvement/)).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Ajouter 0 résultat(s) sélectionné(s)' }),
  ).toBeDisabled();
});

test('correction versionnée : valeur lue conservée, motif, historique et refus d’une version périmée', async ({
  page,
}) => {
  test.skip(process.env.HC_PERSONAL_E2E_STORAGE !== 'postgres', 'Corrections require PostgreSQL');
  await open(page, '/documents');
  await page
    .locator('.documents-hero')
    .getByRole('button', { name: 'Importer une démo', exact: true })
    .click();
  const importDialog = page.getByRole('dialog');
  await importDialog.getByRole('combobox', { name: 'Exemple PDF' }).selectOption('colonnes');
  await importDialog.getByRole('button', { name: 'Essayer ce PDF' }).click();
  await importDialog.getByRole('button', { name: 'Ajouter 3 résultat(s) sélectionné(s)' }).click();
  await expect(importDialog.getByText(/3 résultat\(s\) ajouté\(s\)/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.locator('.document-card', { hasText: 'Bilan PDF · 3 octobre 2026' }).click();
  const source = page.getByRole('dialog');
  await source.getByRole('button', { name: 'Corriger Ferritine' }).click();
  await expect(source.locator('.correction-form .source-quote')).toContainText(
    'Ferritine | 58 | μg/L | 30 - 300',
  );
  await source.getByLabel('Nouvelle valeur (µg/L)').fill('56,5');
  await source.getByLabel('Motif de la correction').fill('erreur de lecture du tableau');
  await source.getByRole('button', { name: 'Enregistrer la correction' }).click();
  await expect(source.getByText(/Correction v1 enregistrée pour Ferritine/)).toBeVisible();
  await expect(source.locator('.highlight-row, tbody tr', { hasText: 'Ferritine' })).toContainText(
    '56,5 µg/L · corrigée v1 · lu 58',
  );
  await source.getByText('Historique des corrections (1)').click();
  await expect(source.locator('.correction-history')).toContainText(
    '« erreur de lecture du tableau »',
  );
  await page.screenshot({ path: `${shots}/11-correction.png`, fullPage: true });

  const record = await (await page.request.get('/api/records/demo-alpha')).json();
  const ferritin = record.observations.find(
    (o: { sourceId: string; code: string; corrections?: unknown[] }) =>
      o.sourceId.startsWith('pdf-') && o.code === 'FERRITIN' && o.corrections,
  );
  expect(ferritin.value).toBe(56.5);
  expect(ferritin.evidence.originalValue).toBe(58);
  expect(ferritin.quality).toBe('needs-review');

  const stale = await page.evaluate(
    async (id) =>
      (
        await fetch('/api/observations/correct', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            observationId: id,
            expectedVersion: 0,
            value: '57',
            reason: 'formulaire ancien',
          }),
        })
      ).status,
    ferritin.id,
  );
  expect(stale).toBe(409);
});

test('doublon inter-documents : même paramètre le même jour signalé et décoché, ajout seulement explicite', async ({
  page,
}) => {
  test.skip(process.env.HC_PERSONAL_E2E_STORAGE !== 'postgres', 'PDF staging requires PostgreSQL');
  // The standard PDF (17/11/2026) is confirmed by the earlier PDF test.
  await open(page, '/documents');
  await page
    .locator('.documents-hero')
    .getByRole('button', { name: 'Importer une démo', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Exemple PDF' }).selectOption('decimales');
  await dialog.getByRole('button', { name: 'Essayer ce PDF' }).click();
  await expect(dialog.locator('.pdf-overlap')).toHaveCount(3);
  await expect(dialog.locator('.pdf-overlap').first()).toContainText(
    'Déjà dans le dossier le même jour : 1,27 g/L · Bilan PDF · 17 novembre 2026 · valeur différente',
  );
  const ldl = dialog.getByRole('checkbox', { name: 'Ajouter LDL-cholestérol', exact: true });
  await expect(ldl).toBeEnabled();
  await expect(ldl).not.toBeChecked();
  await expect(
    dialog.getByRole('button', { name: 'Ajouter 0 résultat(s) sélectionné(s)' }),
  ).toBeDisabled();
  await page.screenshot({ path: `${shots}/12-overlap.png`, fullPage: true });
  await ldl.check();
  await expect(
    dialog.getByRole('button', { name: 'Ajouter 1 résultat(s) sélectionné(s)' }),
  ).toBeEnabled();
});

test('résumé de consultation : téléchargement PDF depuis les paramètres, période contrôlée, session requise', async ({
  page,
}) => {
  await open(page, '/settings');
  await page.getByRole('combobox', { name: 'Période du résumé' }).selectOption('90');
  const link = page.getByRole('link', { name: 'Télécharger le résumé' });
  await expect(link).toHaveAttribute('href', '/api/summary?period=90');
  const download = page.waitForEvent('download');
  await link.click();
  expect((await download).suggestedFilename()).toBe('convergence-resume-90j.pdf');
  const response = await page.request.get('/api/summary?period=365');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  expect((await page.request.get('/api/summary?period=7')).status()).toBe(422);
  const anonymous = await page.context().browser()!.newContext();
  expect(
    (await anonymous.request.get(page.url().replace('/settings', '/api/summary'))).status(),
  ).toBe(401);
  await anonymous.close();
});

test('passeport de qualité : couverture, appareils et limites depuis la vue d’ensemble, accessible', async ({
  page,
}) => {
  await open(page, '/');
  await expect(page.locator('.quality-strip p')).toContainText('paramètres suivis');
  await page.getByRole('button', { name: 'Passeport de qualité' }).click();
  const dialog = page.getByRole('dialog', { name: 'Passeport de qualité' });
  await expect(
    dialog.getByRole('heading', { name: /Quotidien · 90 derniers jours/ }),
  ).toBeVisible();
  await expect(dialog.locator('.passport-table tbody tr')).toHaveCount(4);
  await expect(dialog.getByText(/VFC \(SDNN\)/)).toBeVisible();
  await expect(dialog.getByText(/\d+ \/ 90 jours/).first()).toBeVisible();
  await expect(dialog.locator('.passport-card').first()).toContainText('Laboratoire(s)');
  await expect(
    dialog
      .getByText('Plusieurs laboratoires : références propres à chacun, non interchangeables.')
      .first(),
  ).toBeVisible();
  const result = await new AxeBuilder({ page })
    .include('[role=dialog]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({ path: `${shots}/13-passport.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('autorisations : retrait depuis les paramètres, import PDF refusé par la base, rétablissement versionné', async ({
  page,
}) => {
  test.skip(process.env.HC_PERSONAL_E2E_STORAGE !== 'postgres', 'Consents require PostgreSQL');
  await open(page, '/settings');
  const section = page.locator('.consent-settings');
  await expect(section.getByText('Autorisé', { exact: true })).toHaveCount(2);
  await section.getByRole('button', { name: 'Retirer : Documents PDF' }).click();
  await expect(section.getByRole('button', { name: 'Autoriser : Documents PDF' })).toBeVisible();
  await section
    .getByText(/^Historique \(\d+\)$/)
    .first()
    .click();
  await expect(section.locator('li', { hasText: 'retiré' }).first()).toContainText(
    'personal:demo-alpha',
  );
  await page.screenshot({ path: `${shots}/14-consents.png`, fullPage: true });

  await page.locator('.sidebar nav a[href="/documents"]').click();
  await page
    .locator('.documents-hero')
    .getByRole('button', { name: 'Importer une démo', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Exemple PDF' }).selectOption('scan');
  await dialog.getByRole('button', { name: 'Essayer ce PDF' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Import de documents PDF désactivé : l’autorisation a été retirée dans Paramètres.',
  );
  await page.keyboard.press('Escape');

  await page.locator('.sidebar a[href="/settings"]').click();
  await page
    .locator('.consent-settings')
    .getByRole('button', { name: 'Autoriser : Documents PDF' })
    .click();
  await expect(
    page.locator('.consent-settings').getByRole('button', { name: 'Retirer : Documents PDF' }),
  ).toBeVisible();
  const consents = await (await page.request.get('/api/consents')).json();
  const pdf = consents.find((c: { source: string }) => c.source === 'pdf-documents');
  expect(pdf.granted).toBe(true);
  expect(pdf.history.map((h: { granted: boolean }) => h.granted).slice(-2)).toEqual([false, true]);
});

test('mesures du centre : catégorie dédiée, protocole affiché, sans référence, source et PDF reliés', async ({
  page,
}) => {
  await open(page, '/biology');
  await page
    .getByRole('combobox', { name: 'Catégorie biologique' })
    .selectOption('Mesures du centre');
  await expect(page.locator('.biomarker-option')).toHaveCount(6);
  await page.locator('.biomarker-option', { hasText: 'Tour de taille' }).click();
  await page.getByRole('checkbox', { name: 'Tout l’historique' }).check();
  await expect(page.locator('.large-value')).toContainText('84');
  const protocol = page.locator('.reference-card', {
    hasText: 'Protocole de la mesure sélectionnée',
  });
  await expect(protocol).toContainText('Mètre ruban');
  await expect(page.getByText('Référence du bilan sélectionné')).toHaveCount(0);
  await expect(page.locator('.table-scroll tbody tr')).toHaveCount(2);
  await page.screenshot({ path: `${shots}/15-centre.png`, fullPage: true });
  await page.getByRole('button', { name: 'Bilan source' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('tbody tr', { hasText: 'Tour de taille' })).toContainText(
    'Sans référence · Mètre ruban',
  );
  const href = await dialog.getByRole('link', { name: /Ouvrir le PDF/ }).getAttribute('href');
  const pdf = await page.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
});

test('données du téléphone : jamais autorisées par défaut, import refusé puis accepté, résumé affiché', async ({
  page,
}) => {
  test.skip(process.env.HC_PERSONAL_E2E_STORAGE !== 'postgres', 'Phone data requires PostgreSQL');
  await open(page, '/settings');
  const consent = page.locator('.consent-settings .source-setting', {
    hasText: 'Données santé du téléphone',
  });
  await expect(consent.getByText('Non autorisé', { exact: true })).toBeVisible();
  await expect(page.locator('.device-health')).toContainText(
    'Depuis l’application mobile uniquement',
  );
  const send = () =>
    page.evaluate(async () => {
      const res = await fetch('/api/device-imports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          platform: 'healthkit',
          samples: [
            {
              dataType: 'restingHeartRate',
              value: 53,
              unit: 'bpm',
              startDate: '2026-11-17T06:00:00.000Z',
              endDate: '2026-11-17T06:00:00.000Z',
              sourceName: 'Montre de test',
              sourceId: 'rhr-1',
            },
          ],
        }),
      });
      return { status: res.status, body: await res.json() };
    });
  expect(await send()).toEqual({ status: 403, body: { error: 'CONSENT_REQUIRED' } });
  await consent.getByRole('button', { name: 'Autoriser : Données santé du téléphone' }).click();
  await expect(consent.getByText('Autorisé', { exact: true })).toBeVisible();
  expect(await send()).toEqual({ status: 200, body: { inserted: 1, duplicates: 0 } });
  expect((await send()).body).toEqual({ inserted: 0, duplicates: 1 });
  await page.reload();
  await expect(page.locator('.device-series')).toContainText('FC au repos · 1 enregistrement(s)');
  await expect(page.locator('.device-series')).toContainText('Santé (iPhone)');
});

test('données du téléphone affichées : nuits et cœur en vue d’ensemble, pas en sport, séparées du jeu fictif', async ({
  page,
}) => {
  test.skip(process.env.HC_PERSONAL_E2E_STORAGE !== 'postgres', 'Phone data requires PostgreSQL');
  await open(page, '/settings');
  const consent = page.locator('.consent-settings .source-setting', {
    hasText: 'Données santé du téléphone',
  });
  // Granted by the previous test in this run, or grant it now.
  if (await consent.getByRole('button', { name: /Autoriser/ }).count())
    await consent.getByRole('button', { name: /Autoriser/ }).click();
  await expect(consent.getByText('Autorisé', { exact: true })).toBeVisible();
  const day = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const status = await page.evaluate(async (d) => {
    const s = (x: object) => ({ unit: 'minute', dataType: 'sleep', ...x });
    const res = await fetch('/api/device-imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        platform: 'healthkit',
        samples: [
          s({
            value: 480,
            sleepState: 'inBed',
            startDate: `${d}T21:00:00.000Z`,
            endDate: `${d}T05:00:00.000Z`.replace(d, d),
          }),
          s({
            value: 300,
            sleepState: 'asleep',
            startDate: `${d}T00:00:00.000Z`,
            endDate: `${d}T05:00:00.000Z`,
          }),
          s({
            value: 60,
            sleepState: 'deep',
            startDate: `${d}T05:00:00.000Z`,
            endDate: `${d}T06:00:00.000Z`,
          }),
          {
            dataType: 'steps',
            unit: 'count',
            value: 8421,
            aggregation: 'daily-total',
            startDate: `${d}T00:00:00.000Z`,
            endDate: `${d}T23:00:00.000Z`,
          },
          {
            dataType: 'heartRateVariability',
            unit: 'millisecond',
            value: 44,
            startDate: `${d}T06:00:00.000Z`,
            endDate: `${d}T06:00:00.000Z`,
          },
        ],
      }),
    });
    return res.status;
  }, day);
  expect(status).toBe(422);
  const ok = await page.evaluate(async (d) => {
    const res = await fetch('/api/device-imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        platform: 'healthkit',
        samples: [
          {
            dataType: 'sleep',
            unit: 'minute',
            value: 300,
            sleepState: 'asleep',
            startDate: `${d}T00:00:00.000Z`,
            endDate: `${d}T05:00:00.000Z`,
          },
          {
            dataType: 'sleep',
            unit: 'minute',
            value: 60,
            sleepState: 'deep',
            startDate: `${d}T05:00:00.000Z`,
            endDate: `${d}T06:00:00.000Z`,
          },
          {
            dataType: 'sleep',
            unit: 'minute',
            value: 420,
            sleepState: 'inBed',
            startDate: `${d}T00:00:00.000Z`,
            endDate: `${d}T07:00:00.000Z`,
          },
          {
            dataType: 'steps',
            unit: 'count',
            value: 8421,
            aggregation: 'daily-total',
            startDate: `${d}T00:00:00.000Z`,
            endDate: `${d}T23:00:00.000Z`,
          },
          {
            dataType: 'heartRateVariability',
            unit: 'millisecond',
            value: 44,
            startDate: `${d}T06:00:00.000Z`,
            endDate: `${d}T06:00:00.000Z`,
          },
        ],
      }),
    });
    return res.status;
  }, day);
  expect(ok).toBe(200);
  const record = await (await page.request.get('/api/records/demo-alpha')).json();
  expect(record.device.sleepHours).toEqual([{ day, value: 6 }]);
  expect(record.device.steps).toEqual([{ day, value: 8421 }]);
  expect(record.device.hrv).toEqual([{ method: 'SDNN', values: [{ day, value: 44 }] }]);
  expect(record.sleep.length).toBeGreaterThan(80);
  await page.locator('.sidebar nav a[href="/"]').click();
  const rest = page.locator('.phone-panel', { hasText: 'Nuits et cœur, tels que mesurés' });
  await expect(rest).toContainText('VFC (SDNN) : 1 jour(s) mesuré(s), dernière valeur 44 ms.');
  await expect(rest).toContainText('au lit et éveils exclus');
  await rest.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await rest.screenshot({ path: `${shots}/17-phone-overview.png` });
  await page.getByRole('button', { name: 'Passeport de qualité' }).click();
  const passport = page.getByRole('dialog', { name: 'Passeport de qualité' });
  await expect(
    passport.getByRole('heading', { name: /Téléphone · 90 derniers jours/ }),
  ).toBeVisible();
  await expect(passport.locator('tr', { hasText: 'Pas (téléphone)' })).toContainText(
    'Total quotidien calculé par la plateforme',
  );
  await page.keyboard.press('Escape');
  expect((await page.request.get('/api/summary?period=90')).status()).toBe(200);
  await page.locator('.sidebar nav a[href="/sport"]').click();
  await expect(
    page.locator('.phone-panel', { hasText: 'Pas et distance au quotidien' }),
  ).toContainText('dédoublonne téléphone et montre');
});
