import 'server-only';
import { storageMode } from '../storage/mode';
import { databaseCall } from '../storage/postgres';
import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export const localRoot = process.env.HC_PERSONAL_DATA_DIR || join(process.cwd(), '.local');
export async function audit(subject: string, event: string, resourceId: string) {
  if (storageMode() === 'postgres') {
    await databaseCall('SELECT personal.api_audit($1,$2,$3) AS result', [
      subject,
      event,
      resourceId,
    ]);
    return;
  }
  await mkdir(localRoot, { recursive: true, mode: 0o700 });
  await appendFile(
    join(localRoot, 'audit.ndjson'),
    JSON.stringify({ id: randomUUID(), at: new Date().toISOString(), subject, event, resourceId }) +
      '\n',
    { mode: 0o600 },
  );
}
