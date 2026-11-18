import 'server-only';
import { identity } from '../identity/server';
import { authorize } from '../identity/token';
import { getRecord } from './repository';
import { storageMode } from '../storage/mode';
import { audit } from '../audit/server';
export async function readPersonalRecord(personId: string) {
  const user = await identity();
  try {
    authorize(user, personId);
  } catch (e) {
    await audit(user?.subject || 'anonymous', 'denied_read', 'personal-record');
    throw e;
  }
  const record = await getRecord(personId, user!.subject);
  if (storageMode() === 'local') await audit(user!.subject, 'read_record', personId);
  return record;
}
