import 'server-only';
import { databaseCall } from '../storage/postgres';
import { storageMode } from '../storage/mode';
import type { DeviceImport, DeviceSeries } from './model';
import { recordKey } from './key';
export async function importDeviceRecords(personId: string, subject: string, data: DeviceImport) {
  if (storageMode() !== 'postgres') throw Error('DEVICE_REQUIRES_POSTGRES');
  const now = Date.now() + 5 * 60_000;
  if (data.samples.some((s) => Date.parse(s.endDate) > now)) throw Error('INVALID_DEVICE_DATA');
  const records = data.samples.map((s) => ({
    type: s.dataType,
    key: recordKey(data.platform, s),
    start: new Date(s.startDate).toISOString(),
    end: new Date(s.endDate).toISOString(),
    value: s.value,
    unit: s.unit,
    sourceName: s.sourceName ?? null,
  }));
  const r = await databaseCall<{ status: string; inserted: number; duplicates: number }>(
    'SELECT personal.api_device_import($1,$2,$3,$4::jsonb) AS result',
    [subject, personId, data.platform, JSON.stringify(records)],
  );
  if (r.status !== 'ok')
    throw Error(r.status === 'forbidden' ? 'FORBIDDEN' : 'INVALID_DEVICE_DATA');
  return { inserted: r.inserted, duplicates: r.duplicates };
}
export async function deviceSummary(personId: string, subject: string) {
  if (storageMode() !== 'postgres') return [] as DeviceSeries[];
  const r = await databaseCall<{ status: string; series: DeviceSeries[] }>(
    'SELECT personal.api_device_summary($1,$2) AS result',
    [subject, personId],
  );
  if (r.status !== 'ok') throw Error('FORBIDDEN');
  return r.series;
}
