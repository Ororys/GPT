import { createHash } from 'node:crypto';
import type { DeviceImport } from './model';
/** Idempotence key: the same phone record sent twice is stored once. */
export function recordKey(platform: string, s: DeviceImport['samples'][number]) {
  return createHash('sha256')
    .update([platform, s.dataType, s.sourceId ?? '', s.startDate, s.endDate, s.value].join('\n'))
    .digest('base64url');
}
