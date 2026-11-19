'use client';
import { DEVICE_UNIT, type DeviceSampleInput } from './model';
/** True only inside the Capacitor shell (apps/mobile), never in a desktop or mobile browser. */
export function isNativeApp() {
  const c = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!c?.isNativePlatform?.();
}
/**
 * Asks the phone for read access (nothing is written), reads the last `days` days and sends
 * them in batches. Steps and distance come from the platform's daily totals, which
 * deduplicate phone and watch; sleep keeps the state of every segment (or stage).
 */
type Send = (batch: {
  platform: 'healthkit' | 'health-connect';
  samples: DeviceSampleInput[];
}) => Promise<{ inserted: number; duplicates: number }>;
/** Hosted version: the server route. The on-device record passes its own store instead. */
const sendToServer: Send = async (batch) => {
  const res = await fetch('/api/device-imports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(batch),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || 'DEVICE_IMPORT_FAILED');
  return data;
};
export async function importPhoneHealth(days = 30, send: Send = sendToServer) {
  const { Capacitor } = await import('@capacitor/core');
  const { Health } = await import('@capgo/capacitor-health');
  const platform = Capacitor.getPlatform() === 'ios' ? 'healthkit' : 'health-connect';
  const availability = await Health.isAvailable();
  if (!availability.available) throw Error('HEALTH_UNAVAILABLE');
  await Health.requestAuthorization({
    read: ['sleep', 'restingHeartRate', 'heartRateVariability', 'steps', 'distance'],
  });
  const range = {
    startDate: new Date(Date.now() - days * 86_400_000).toISOString(),
    endDate: new Date().toISOString(),
  };
  const samples: DeviceSampleInput[] = [];
  for (const dataType of ['steps', 'distance'] as const) {
    const { samples: buckets } = await Health.queryAggregated({
      dataType,
      ...range,
      bucket: 'day',
      aggregation: 'sum',
    });
    for (const b of buckets)
      if (b.unit === DEVICE_UNIT[dataType] && Number.isFinite(b.value))
        samples.push({
          dataType,
          value: b.value,
          unit: b.unit,
          startDate: b.startDate,
          endDate: b.endDate,
          aggregation: 'daily-total',
        });
  }
  for (const dataType of ['restingHeartRate', 'heartRateVariability', 'sleep'] as const) {
    const { samples: rows } = await Health.readSamples({
      dataType,
      ...range,
      limit: 5000,
      ascending: true,
    });
    for (const s of rows) {
      const id = (s.platformId ?? s.sourceId)?.slice(0, 200);
      const base = {
        ...(s.sourceName ? { sourceName: s.sourceName.slice(0, 100) } : {}),
        ...(id ? { sourceId: id } : {}),
      };
      if (dataType !== 'sleep') {
        if (s.unit === DEVICE_UNIT[dataType])
          samples.push({
            dataType,
            value: s.value,
            unit: s.unit,
            startDate: s.startDate,
            endDate: s.endDate,
            ...base,
          });
        continue;
      }
      // Stage-level data when the platform exposes it, otherwise the segment's own state.
      const segments = s.stages?.length
        ? s.stages.map((g) => ({
            start: g.startDate,
            end: g.endDate,
            minutes: g.durationMinutes,
            state: g.stage,
          }))
        : s.sleepState
          ? [{ start: s.startDate, end: s.endDate, minutes: s.value, state: s.sleepState }]
          : [];
      for (const g of segments)
        samples.push({
          dataType: 'sleep',
          value: g.minutes,
          unit: 'minute',
          startDate: g.start,
          endDate: g.end,
          sleepState: g.state,
          ...base,
          ...(id ? { sourceId: `${id}:${g.start}` } : {}),
        });
    }
  }
  let inserted = 0,
    duplicates = 0;
  for (let i = 0; i < samples.length; i += 500) {
    const data = await send({ platform, samples: samples.slice(i, i + 500) });
    inserted += data.inserted;
    duplicates += data.duplicates;
  }
  return { read: samples.length, inserted, duplicates };
}
