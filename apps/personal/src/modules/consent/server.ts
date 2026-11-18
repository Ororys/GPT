import 'server-only';
import { databaseCall } from '../storage/postgres';
import { storageMode } from '../storage/mode';
import type { ConsentSource, ConsentState } from './model';
export async function readConsents(personId: string, subject: string) {
  if (storageMode() !== 'postgres') throw Error('CONSENT_REQUIRES_POSTGRES');
  const r = await databaseCall<{ status: string; consents: ConsentState[] }>(
    'SELECT personal.api_consents($1,$2) AS result',
    [subject, personId],
  );
  if (r.status !== 'ok') throw Error('FORBIDDEN');
  return r.consents;
}
export async function setConsent(
  personId: string,
  subject: string,
  source: ConsentSource,
  expectedVersion: number,
  granted: boolean,
) {
  if (storageMode() !== 'postgres') throw Error('CONSENT_REQUIRES_POSTGRES');
  const r = await databaseCall<{ status: string; version?: number }>(
    'SELECT personal.api_set_consent($1,$2,$3,$4,$5) AS result',
    [subject, personId, source, expectedVersion, granted],
  );
  if (r.status === 'ok') return { version: r.version!, granted };
  throw Error(
    r.status === 'forbidden'
      ? 'FORBIDDEN'
      : r.status === 'conflict'
        ? 'CONSENT_CONFLICT'
        : 'INVALID_CONSENT',
  );
}
