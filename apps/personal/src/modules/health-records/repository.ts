import 'server-only';
import { createHash } from 'node:crypto';
import type { HealthRecord } from './model';
import { PERSON_ALPHA } from './model';
import { TEMPLATE_TEXT } from '../documents/import-contract';
import { databaseCall } from '../storage/postgres';
import { storageMode } from '../storage/mode';
import * as local from './local-repository';
export async function getRecord(personId: string, subject: string): Promise<HealthRecord> {
  if (storageMode() === 'local') return local.getRecord(personId);
  const r = await databaseCall<{ status: string; record: HealthRecord }>(
    'SELECT personal.api_get_record($1,$2) AS result',
    [subject, personId],
  );
  if (r.status !== 'ok') throw Error(r.status === 'forbidden' ? 'FORBIDDEN' : 'NOT_FOUND');
  return r.record;
}
export async function importDemo(text: string, personId: string, subject: string) {
  if (Buffer.byteLength(text) > 100_000) throw Error('PAYLOAD_TOO_LARGE');
  if (personId !== PERSON_ALPHA) throw Error('FORBIDDEN');
  const sha = createHash('sha256').update(text).digest('hex');
  if (sha !== createHash('sha256').update(TEMPLATE_TEXT).digest('hex'))
    throw Error('INVALID_DEMO_FILE');
  if (storageMode() === 'local') return local.importDemo(text, personId);
  const r = await databaseCall<{
    status: string;
    inserted: number;
    duplicates: number;
    sha256: string;
  }>('SELECT personal.api_import($1,$2,$3) AS result', [subject, personId, sha]);
  if (r.status !== 'ok') throw Error(r.status === 'forbidden' ? 'FORBIDDEN' : 'INVALID_DEMO_FILE');
  return { inserted: r.inserted, duplicates: r.duplicates, sha256: r.sha256 };
}
