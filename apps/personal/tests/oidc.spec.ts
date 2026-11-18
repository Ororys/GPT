import { test, expect } from '@playwright/test';
const idp = process.env.HC_PERSONAL_OIDC_ISSUER!;
const nextUser = (page: import('@playwright/test').Page, user: object) =>
  page.request.post(`${idp}/test/next`, { data: user });

test('connexion réelle : écran de connexion, profils fictifs désactivés, accès protégé', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connexion à votre espace' })).toBeVisible();
  expect((await page.request.get('/api/records/demo-alpha')).status()).toBe(401);
  const demo = await page.request.post('/api/session', {
    data: { personId: 'demo-alpha' },
    headers: { origin: 'http://127.0.0.1:3100' },
  });
  expect(demo.status()).toBe(403);
  expect((await demo.json()).error).toBe('DEMO_AUTH_DISABLED');
  expect((await (await page.request.get('/api/auth/status')).json()).mode).toBe('oidc');
});

test('sans double authentification : aucun accès ouvert', async ({ page }) => {
  await nextUser(page, { sub: 'alex-real', amr: ['pwd'] });
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('.login-state [role=alert]')).toContainText(
    'La double authentification est requise',
  );
  expect((await page.request.get('/api/records/demo-alpha')).status()).toBe(401);
});

test('identité valide mais non rattachée : refus, aucun dossier créé', async ({ page }) => {
  await nextUser(page, { sub: 'stranger', amr: ['pwd', 'mfa'] });
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('.login-state [role=alert]')).toContainText(
    'rattachée à aucun dossier',
  );
  expect((await (await page.request.get('/api/auth/status')).json()).authenticated).toBe(false);
});

test('jeton émis pour une autre application : refusé', async ({ page }) => {
  await nextUser(page, { sub: 'alex-real', amr: ['mfa'], audience: 'other-app' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('.login-state [role=alert]')).toContainText('n’a pas pu être vérifiée');
});

test('état falsifié au retour : refusé sans session', async ({ page }) => {
  await page.goto('/api/auth/callback?code=forged&state=forged');
  await expect(page.locator('.login-state [role=alert]')).toContainText('n’a pas pu être vérifiée');
  expect((await (await page.request.get('/api/auth/status')).json()).authenticated).toBe(false);
});

test('connexion avec double authentification : dossier rattaché ouvert, puis déconnexion', async ({
  page,
}) => {
  await nextUser(page, {
    sub: 'alex-real',
    amr: ['pwd', 'otp', 'mfa'],
    audience: 'convergence-e2e',
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('.sidebar-profile strong')).toContainText('Alex');
  const status = await (await page.request.get('/api/auth/status')).json();
  expect(status).toEqual({ mode: 'oidc', authenticated: true, personId: 'demo-alpha' });
  expect((await page.request.get('/api/records/demo-alpha')).status()).toBe(200);
  expect((await page.request.get('/api/records/demo-beta')).status()).toBe(403);
  const cookie = (await page.context().cookies()).find((c) => c.name === 'hc_personal_demo')!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Strict');
  expect(new URL(page.url()).host).toBe('127.0.0.1:3100');
  await page.locator('.sidebar a[href="/settings"]').click();
  await expect(page.getByRole('heading', { name: 'Votre connexion' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Camille Durand/ })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/screenshots/16-oidc-settings.png', fullPage: true });
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion à votre espace' })).toBeVisible();
  expect((await page.request.get('/api/records/demo-alpha')).status()).toBe(401);
});
