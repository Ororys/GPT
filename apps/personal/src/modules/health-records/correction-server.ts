import 'server-only';
import { databaseCall } from '../storage/postgres';
import { storageMode } from '../storage/mode';
import type { CorrectionRequest } from './corrections';
export async function correctObservation(personId: string, subject: string, c: CorrectionRequest) {
  if (storageMode() !== 'postgres') throw Error('CORRECTION_REQUIRES_POSTGRES');
  const r = await databaseCall<{ status: string; version?: number }>(
    'SELECT personal.api_correct_observation($1,$2,$3,$4,$5,$6) AS result',
    [subject, personId, c.observationId, c.expectedVersion, c.value, c.reason],
  );
  if (r.status === 'ok') return { version: r.version! };
  throw Error(
    r.status === 'forbidden'
      ? 'FORBIDDEN'
      : r.status === 'not_found'
        ? 'NOT_FOUND'
        : r.status === 'conflict'
          ? 'CORRECTION_CONFLICT'
          : 'INVALID_CORRECTION',
  );
}
