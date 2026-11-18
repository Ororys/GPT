import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import {
  readOidcSettings,
  subjectFor,
  verifyIdToken,
  pkceChallenge,
  OIDC_SUBJECT,
} from '../src/modules/identity/oidc-core';
import { issueOidcSession, issueSession, verifySession } from '../src/modules/identity/token';

const settings = readOidcSettings({
  HC_PERSONAL_OIDC_ISSUER: 'https://id.example.test/',
  HC_PERSONAL_OIDC_CLIENT_ID: 'convergence',
  HC_PERSONAL_OIDC_REDIRECT_URI: 'https://app.example.test/api/auth/callback',
});
const secret = 'x'.repeat(40);
async function keys() {
  const pair = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
  return { pair, set: createLocalJWKSet({ keys: [jwk] }) };
}
async function token(
  key: CryptoKey,
  claims: Record<string, unknown> = {},
  o: { iss?: string; aud?: string; exp?: string | number; sub?: string } = {},
) {
  return new SignJWT({ nonce: 'n-1', amr: ['pwd', 'mfa'], ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(o.iss ?? 'https://id.example.test')
    .setSubject(o.sub ?? 'user-42')
    .setAudience(o.aud ?? 'convergence')
    .setIssuedAt()
    .setExpirationTime(o.exp ?? '5m')
    .sign(key);
}

test('OIDC : jeton valide avec double authentification, sujet haché et stable', async () => {
  const { pair, set } = await keys();
  const login = await verifyIdToken(await token(pair.privateKey), set, settings, 'n-1');
  assert.equal(login.subject, subjectFor('https://id.example.test', 'user-42'));
  assert.match(login.subject, OIDC_SUBJECT);
  assert.ok(!login.subject.includes('user-42'), 'aucun identifiant brut');
  assert.notEqual(subjectFor('https://other.test', 'user-42'), login.subject);
});
test('OIDC : signature, émetteur, audience, nonce, expiration et alg none refusés', async () => {
  const { pair, set } = await keys();
  const other = await generateKeyPair('RS256');
  const cases = [
    await token(other.privateKey),
    await token(pair.privateKey, {}, { iss: 'https://evil.test' }),
    await token(pair.privateKey, {}, { aud: 'another-app' }),
    await token(pair.privateKey, { nonce: 'replayed' }),
    await token(pair.privateKey, {}, { exp: Math.floor(Date.now() / 1000) - 3600 }),
    Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') +
      '.' +
      Buffer.from(
        JSON.stringify({
          iss: 'https://id.example.test',
          aud: 'convergence',
          sub: 'x',
          nonce: 'n-1',
          amr: ['mfa'],
          exp: Math.floor(Date.now() / 1000) + 60,
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toString('base64url') +
      '.',
  ];
  for (const t of cases)
    await assert.rejects(verifyIdToken(t, set, settings, 'n-1'), /OIDC_INVALID_TOKEN/);
});
test('OIDC : sans facteur exigé (amr), connexion refusée', async () => {
  const { pair, set } = await keys();
  await assert.rejects(
    verifyIdToken(await token(pair.privateKey, { amr: ['pwd'] }), set, settings, 'n-1'),
    /OIDC_MFA_REQUIRED/,
  );
  await assert.rejects(
    verifyIdToken(await token(pair.privateKey, { amr: undefined }), set, settings, 'n-1'),
    /OIDC_MFA_REQUIRED/,
  );
  const hwk = { ...settings, requiredAmr: ['hwk'] };
  await assert.rejects(
    verifyIdToken(await token(pair.privateKey), set, hwk, 'n-1'),
    /OIDC_MFA_REQUIRED/,
  );
});
test('configuration : HTTPS obligatoire hors machine locale, PKCE S256 conforme RFC 7636', () => {
  const base = {
    HC_PERSONAL_OIDC_CLIENT_ID: 'c',
    HC_PERSONAL_OIDC_REDIRECT_URI: 'https://a.test/cb',
  };
  assert.throws(
    () => readOidcSettings({ ...base, HC_PERSONAL_OIDC_ISSUER: 'http://id.example.test' }),
    /OIDC_MISCONFIGURED/,
  );
  assert.doesNotThrow(() =>
    readOidcSettings({ ...base, HC_PERSONAL_OIDC_ISSUER: 'http://127.0.0.1:3199' }),
  );
  assert.throws(() => readOidcSettings({}), /OIDC_MISCONFIGURED/);
  // RFC 7636 appendix B test vector.
  assert.equal(
    pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
});
test('sessions : chaque mode n’accepte que ses propres sessions', () => {
  const demo = issueSession('demo-alpha', secret);
  const real = issueOidcSession(subjectFor('https://id.example.test', 'u'), 'demo-alpha', secret);
  assert.equal(verifySession(demo, secret, Date.now(), 'demo')?.personId, 'demo-alpha');
  assert.equal(verifySession(demo, secret, Date.now(), 'oidc'), null);
  assert.equal(verifySession(real, secret, Date.now(), 'oidc')?.auth, 'oidc');
  assert.equal(verifySession(real, secret, Date.now(), 'demo'), null);
  assert.equal(verifySession(real, 'y'.repeat(40), Date.now(), 'oidc'), null);
  assert.equal(verifySession(real, secret, Date.now() + 2 * 3600_000, 'oidc'), null);
  assert.throws(() => issueOidcSession('personal:demo-alpha', 'demo-alpha', secret));
});
