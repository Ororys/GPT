import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
/** On-device mode: everything happens in the page; nothing may leave this origin. */
async function samplePdf(text: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  page.drawText(text, { x: 50, y: 700, font: await doc.embedFont(StandardFonts.Helvetica) });
  doc.addPage();
  return Buffer.from(await doc.save());
}
function watchRequests(page: Page, allowed = ['127.0.0.1:3200']) {
  const outside: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!allowed.includes(url.host) && !['data:', 'blob:'].includes(url.protocol))
      outside.push(r.url());
  });
  return outside;
}
async function onboard(page: Page, code = '482915') {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
  const go = page.getByRole('button', { name: 'Continuer' });
  await expect(go).toBeDisabled();
  await page.getByLabel('Votre prénom').fill('Léa');
  await page.getByLabel('J’ai 18 ans ou plus.').check();
  await expect(go).toBeDisabled();
  await page.getByLabel('J’ai lu ces informations.').check();
  await go.click();
  await page.getByLabel('Code', { exact: true }).fill(code);
  await page.getByLabel('Confirmer le code').fill('000000');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page.locator('.feedback.error')).toContainText('pas identiques');
  await page.getByLabel('Confirmer le code').fill(code);
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page.getByText('SUR CE TÉLÉPHONE', { exact: true })).toBeVisible();
}
test('premier lancement, code, PDF rangé, verrouillage, export puis suppression totale', async ({
  page,
}) => {
  const outside = watchRequests(page);
  await onboard(page);
  await expect(page.getByText('Bonjour Léa.')).toBeVisible();
  // No permission by default: the PDF is refused until « Documents PDF » is authorised.
  await page
    .getByRole('button', { name: /Ajouter un PDF/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Fichier PDF').setInputFiles({
    name: 'bilan-mars.pdf',
    mimeType: 'application/pdf',
    buffer: await samplePdf('Bilan de test'),
  });
  await expect(dialog.getByLabel('Nom du document')).toHaveValue('bilan-mars');
  await dialog.getByLabel('Date du document').fill('2026-03-02');
  await dialog.getByLabel(/Origine/).fill('Laboratoire de test');
  await dialog.getByRole('button', { name: 'Ranger le document' }).click();
  await expect(dialog.locator('.feedback.error')).toContainText(
    'Autorisez d’abord « Documents PDF »',
  );
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).first().click();
  // In-app navigation: reloading the page locks the vault (the key lives only in memory).
  await page.getByRole('button', { name: /ouvrir les paramètres/ }).click();
  await page.getByRole('button', { name: 'Autoriser : Documents PDF' }).click();
  await expect(page.getByRole('button', { name: 'Retirer : Documents PDF' })).toBeVisible();
  await page
    .getByRole('button', { name: /Ajouter un PDF/ })
    .first()
    .click();
  await dialog.getByLabel('Fichier PDF').setInputFiles({
    name: 'bilan-mars.pdf',
    mimeType: 'application/pdf',
    buffer: await samplePdf('Bilan de test'),
  });
  await dialog.getByLabel('Date du document').fill('2026-03-02');
  await dialog.getByLabel(/Origine/).fill('Laboratoire de test');
  await dialog.getByRole('button', { name: 'Ranger le document' }).click();
  await expect(dialog.getByRole('status')).toContainText('« bilan-mars » est rangé');
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).first().click();
  // Documents page: the PDF is there, with its 2 pages counted on the phone.
  await page.getByRole('link', { name: 'Documents' }).first().click();
  const card = page.locator('.document-card', { hasText: 'bilan-mars' });
  await expect(card).toContainText('Laboratoire de test');
  await expect(card).toContainText('2 mars 2026 · 2 page');
  await expect(card).toContainText('PDF rangé · valeurs non lues');
  // Lock, wrong code, then the right one: the document is still there (IndexedDB).
  await page.getByRole('button', { name: /ouvrir les paramètres/ }).click();
  await page.getByRole('button', { name: 'Verrouiller maintenant' }).click();
  await expect(page.getByRole('heading', { name: 'Espace verrouillé' })).toBeVisible();
  await page.getByLabel('Code', { exact: true }).fill('111111');
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await expect(page.locator('.feedback.error')).toContainText('Code incorrect (1 essai)');
  await page.reload();
  await page.getByLabel('Code', { exact: true }).fill('482915');
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await expect(page.getByRole('button', { name: 'Verrouiller maintenant' })).toBeVisible();
  // Export: complete file with the PDF bytes.
  await page.getByRole('button', { name: /ouvrir les paramètres/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter' }).click();
  const file = await (await download).path();
  const exported = JSON.parse(await readFile(file, 'utf8'));
  expect(exported.mode).toBe('device');
  expect(exported.documents).toHaveLength(1);
  expect(Buffer.from(exported.documents[0].pdfBase64, 'base64').subarray(0, 5).toString()).toBe(
    '%PDF-',
  );
  expect(exported.onboarding.adultDeclared).toBe(true);
  // Delete one document from its source window.
  await page.getByRole('link', { name: 'Documents' }).first().click();
  await page.locator('.document-card', { hasText: 'bilan-mars' }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Supprimer ce document' }).click();
  await expect(page.locator('.document-card', { hasText: 'bilan-mars' })).toHaveCount(0);
  // Delete everything: back to the first launch, nothing left.
  await page.getByRole('button', { name: /ouvrir les paramètres/ }).click();
  const erase = page.getByRole('button', { name: 'Supprimer toutes mes données' });
  await expect(erase).toBeDisabled();
  await page.getByLabel('Tapez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await erase.click();
  await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
  const left = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const r = indexedDB.open('convergence-device');
        r.onsuccess = () => {
          const c = r.result.transaction('kv').objectStore('kv').count();
          c.onsuccess = () => resolve(c.result);
        };
      }),
  );
  expect(left).toBe(0);
  expect(outside).toEqual([]);
});
test('retrait d’une autorisation avec effacement, code oublié, accessibilité', async ({ page }) => {
  await onboard(page, '13572468');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.goto('/settings/');
  await page.getByLabel('Code', { exact: true }).fill('13572468');
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.getByRole('button', { name: 'Autoriser : Documents PDF' }).click();
  await page
    .getByRole('button', { name: /Ajouter un PDF/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Fichier PDF').setInputFiles({
    name: 'cr.pdf',
    mimeType: 'application/pdf',
    buffer: await samplePdf('Compte rendu'),
  });
  await dialog.getByRole('button', { name: 'Ranger le document' }).click();
  await expect(dialog.getByRole('status')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).first().click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Retirer et effacer : Documents PDF' }).click();
  await expect(page.getByRole('status')).toContainText('données de cette source effacées');
  await page.getByRole('link', { name: 'Documents' }).first().click();
  await expect(page.getByRole('heading', { name: 'Des documents. Pas des silos.' })).toBeVisible();
  await expect(page.locator('.document-card')).toHaveCount(0);
  // Forgotten code: the only way out is to erase everything.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Espace verrouillé' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Code oublié : tout effacer' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
});

test('lecture par IA : accord à chaque envoi, relais seul contacté, valeurs choisies puis rangées', async ({
  page,
}) => {
  // The app talks to the relay only; never to the AI provider directly.
  const outside = watchRequests(page, ['127.0.0.1:3200', '127.0.0.1:3300']);
  const relayCalls: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).port === '3300') relayCalls.push(r.method());
  });
  await onboard(page, '24681357');
  await page.getByRole('button', { name: /ouvrir les paramètres/ }).click();
  await page.getByRole('button', { name: 'Autoriser : Documents PDF' }).click();
  await expect(page.getByRole('button', { name: 'Retirer : Documents PDF' })).toBeVisible();
  await page
    .getByRole('button', { name: /Ajouter un PDF/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Fichier PDF').setInputFiles({
    name: 'bilan-ia.pdf',
    mimeType: 'application/pdf',
    buffer: await samplePdf('Bilan IA'),
  });
  await dialog.getByLabel('Date du document').fill('2026-03-02');
  await dialog.getByRole('button', { name: 'Ranger le document' }).click();
  await expect(dialog.getByRole('status')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).first().click();
  await page.getByRole('link', { name: 'Documents' }).first().click();
  await page.locator('.document-card', { hasText: 'bilan-ia' }).click();
  await page.getByRole('button', { name: 'Lire les valeurs avec l’IA' }).click();
  const ai = page.getByRole('dialog');
  const send = ai.getByRole('button', { name: 'Envoyer et lire' });
  await expect(send).toBeDisabled();
  await ai.getByLabel('J’accepte l’envoi de ce document à OpenAI.').check();
  // Without the « Lecture des PDF par une IA » permission, nothing is sent.
  await send.click();
  await expect(ai.locator('.feedback.error')).toContainText('Autorisez d’abord « Lecture des PDF');
  expect(relayCalls).toEqual([]);
  await ai.getByRole('button', { name: 'Annuler' }).click();
  await page.getByRole('button', { name: /ouvrir les paramètres/ }).click();
  await page
    .getByRole('button', { name: 'Autoriser : Lecture des PDF par une IA (OpenAI)' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Retirer : Lecture des PDF par une IA (OpenAI)' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Documents' }).first().click();
  await page.locator('.document-card', { hasText: 'bilan-ia' }).click();
  await page.getByRole('button', { name: 'Lire les valeurs avec l’IA' }).click();
  await ai.getByLabel('J’accepte l’envoi de ce document à OpenAI.').check();
  await ai.getByRole('button', { name: 'Envoyer et lire' }).click();
  // Review: printed date shown, « < 0,5 » blocked, nothing added yet.
  await expect(ai).toContainText('date imprimée lue par l’IA : « 02/03/2026 »');
  await expect(ai.getByLabel('Ajouter CRP')).toBeDisabled();
  await expect(ai).toContainText('Valeur non numérique');
  await expect(ai.getByLabel('Ajouter Glycémie à jeun')).toBeChecked();
  await ai.getByLabel('Ajouter Ferritine').uncheck();
  await ai.getByRole('button', { name: 'Ajouter 1 valeur(s)' }).click();
  await expect(ai.getByRole('status')).toContainText(
    '1 valeur(s) ajoutée(s) à votre dossier, à vérifier',
  );
  await ai.getByRole('button', { name: 'Fermer' }).first().click();
  await page.getByRole('link', { name: 'Biologie' }).first().click();
  await expect(page.getByText('Glycémie à jeun').first()).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  expect(relayCalls.filter((m) => m === 'POST')).toHaveLength(1);
  expect(outside).toEqual([]);
});
