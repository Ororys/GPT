'use client';
import { DEVICE_TYPES, DEVICE_UNIT, type DeviceImport } from './model';
/** True only inside the Capacitor shell (apps/mobile), never in a desktop or mobile browser. */
export function isNativeApp() {
  const c = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!c?.isNativePlatform?.();
}
/**
 * Asks the phone for read access (nothing is written), reads the last `days` days and sends
 * them in batches. Plugins are loaded lazily so the website never ships native code paths.
 */
export async function importPhoneHealth(days = 30) {
  const { Capacitor } = await import('@capacitor/core');
  const { Health } = await import('@capgo/capacitor-health');
  const platform: DeviceImport['platform'] =
    Capacitor.getPlatform() === 'ios' ? 'healthkit' : 'health-connect';
  const availability = await Health.isAvailable();
  if (!availability.available) throw Error('HEALTH_UNAVAILABLE');
  await Health.requestAuthorization({ read: [...DEVICE_TYPES] });
  const end = new Date(),
    start = new Date(end.getTime() - days * 86_400_000);
  const samples: DeviceImport['samples'] = [];
  for (const dataType of DEVICE_TYPES) {
    const { samples: rows } = await Health.readSamples({
      dataType,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 2000,
      ascending: true,
    });
    for (const s of rows)
      if (s.unit === DEVICE_UNIT[dataType])
        samples.push({
          dataType,
          value: s.value,
          unit: s.unit,
          startDate: s.startDate,
          endDate: s.endDate,
          ...(s.sourceName ? { sourceName: s.sourceName.slice(0, 100) } : {}),
          ...(s.sourceId ? { sourceId: s.sourceId.slice(0, 200) } : {}),
        });
  }
  let inserted = 0,
    duplicates = 0;
  for (let i = 0; i < samples.length; i += 500) {
    const res = await fetch('/api/device-imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform, samples: samples.slice(i, i + 500) }),
    });
    const data = await res.json();
    if (!res.ok) throw Error(data.error || 'DEVICE_IMPORT_FAILED');
    inserted += data.inserted;
    duplicates += data.duplicates;
  }
  return { read: samples.length, inserted, duplicates };
}
