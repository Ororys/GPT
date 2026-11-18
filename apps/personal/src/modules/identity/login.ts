import 'server-only';
import { databaseCall } from '../storage/postgres';
import { storageMode } from '../storage/mode';
/** Resolves a verified OIDC subject to its enrolled dossier, never creating one. */
export async function enrolledPerson(subject: string) {
  if (storageMode() !== 'postgres') throw Error('OIDC_REQUIRES_POSTGRES');
  const r = await databaseCall<{ status: string; personId?: string }>(
    'SELECT personal.api_identity_person($1) AS result',
    [subject],
  );
  return r.status === 'ok' ? r.personId! : null;
}
