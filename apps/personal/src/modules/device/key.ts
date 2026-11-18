import { createHash } from 'node:crypto';
import type { DeviceSampleInput } from './model';
/** Idempotence key: the same phone record sent twice is stored once. */
export function recordKey(platform: string, s: DeviceSampleInput) {
  return createHash('sha256')
    .update(
      [
        platform,
        s.dataType,
        s.aggregation ?? 'sample',
        s.sleepState ?? '',
        s.sourceId ?? '',
        s.startDate,
        s.endDate,
        s.value,
      ].join('\n'),
    )
    .digest('base64url');
}
