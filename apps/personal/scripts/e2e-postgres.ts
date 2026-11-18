import { spawn } from 'node:child_process';
import { createPersonalTestDatabase } from './test-database';
const db = await createPersonalTestDatabase();
try {
  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        HC_PERSONAL_E2E_STORAGE: 'postgres',
        HC_PERSONAL_DATABASE_URL: db.apiUrl,
      },
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = code;
} finally {
  await db.drop();
}
