import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env.local') || existsSync('.env.database'))
  throw Error('Existing personal environment: left unchanged.');
const admin = randomBytes(24).toString('hex'),
  api = randomBytes(24).toString('hex'),
  secret = randomBytes(32).toString('hex');
writeFileSync(
  '.env.database',
  `HC_PERSONAL_DB_PASSWORD=${admin}\nHC_PERSONAL_ADMIN_DATABASE_URL=postgresql://hc_personal_admin:${admin}@127.0.0.1:55433/hc_personal_demo\n`,
  { mode: 0o600, flag: 'wx' },
);
writeFileSync(
  '.env.local',
  `HC_SYNTHETIC_ONLY=true\nHC_PERSONAL_STORAGE=postgres\nHC_PERSONAL_DATABASE_URL=postgresql://hc_personal_login:${api}@127.0.0.1:55433/hc_personal_demo\nHC_PERSONAL_SESSION_SECRET=${secret}\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log('Private local personal environments created. No real patient data permitted.');
