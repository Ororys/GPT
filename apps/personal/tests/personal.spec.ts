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
