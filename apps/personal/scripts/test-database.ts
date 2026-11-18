import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { prepareDatabase } from './database';
export async function createPersonalTestDatabase(options: { sessionSecret?: string } = {}) {
  const rootUrl = process.env.HC_TEST_ADMIN_URL || process.env.HC_PERSONAL_ADMIN_DATABASE_URL;
  if (!rootUrl)
    throw Error(
      'HC_TEST_ADMIN_URL or HC_PERSONAL_ADMIN_DATABASE_URL required for disposable database',
    );
  const name = 'hc_personal_test_' + randomBytes(6).toString('hex');
  const root = new pg.Client({ connectionString: rootUrl });
  await root.connect();
  await root.query(`CREATE DATABASE ${name}`);
  await root.end();
  const admin = new URL(rootUrl);
  admin.pathname = '/' + name;
  const api = new URL(admin);
  api.username = 'hc_personal_test_login';
  api.password = 'synthetic-test-password-0123456789abcdef';
  let adminPool: pg.Pool | undefined;
  let apiPool: pg.Pool | undefined;
  const drop = async () => {
    await adminPool?.end();
    await apiPool?.end();
    const c = new pg.Client({ connectionString: rootUrl });
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await c.end();
  };
  try {
    await prepareDatabase(admin.href, api.href, options.sessionSecret);
    adminPool = new pg.Pool({ connectionString: admin.href, max: 3 });
    apiPool = new pg.Pool({ connectionString: api.href, max: 8 });
    return { adminUrl: admin.href, apiUrl: api.href, admin: adminPool, api: apiPool, drop };
  } catch (e) {
    await drop();
    throw e;
  }
}
