import { spawn } from 'node:child_process';
import { createPersonalTestDatabase } from './test-database';
import { linkIdentity } from './link-identity';
import { startOidcProvider } from '../tests/helpers/oidc-provider';
const client = { id: 'convergence-e2e', secret: 'synthetic-client-secret-for-tests-only' };
// S-02 exercised end to end: server and database share a synthetic test key.
const sessionSecret = 'synthetic-e2e-session-key-' + 'x'.repeat(40);
const db = await createPersonalTestDatabase({ sessionSecret });
const idp = await startOidcProvider(3199, client.id, client.secret);
try {
  // Controlled enrolment of one test identity to the synthetic Alex dossier.
  await linkIdentity(db.adminUrl, idp.issuer, 'alex-real', 'demo-alpha');
  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          HC_PERSONAL_E2E_STORAGE: 'postgres',
          HC_PERSONAL_E2E_AUTH: 'oidc',
          HC_PERSONAL_DATABASE_URL: db.apiUrl,
          HC_PERSONAL_SESSION_SECRET: sessionSecret,
          HC_PERSONAL_OIDC_ISSUER: idp.issuer,
          HC_PERSONAL_OIDC_CLIENT_ID: client.id,
          HC_PERSONAL_OIDC_CLIENT_SECRET: client.secret,
        },
      },
    );
    child.on('error', reject);
    child.on('exit', (c) => resolve(c ?? 1));
  });
  process.exitCode = code;
} finally {
  await idp.close();
  await db.drop();
}
