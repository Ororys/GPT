import { ASLEEP } from './model';
import { localDay } from '../observations/time';
export interface DeviceRow {
  platform: 'healthkit' | 'health-connect';
  type: string;
  start: string;
  end: string;
  value: number;
  unit: string;
  sleepState: string | null;
  aggregation: 'sample' | 'daily-total';
  sourceName: string | null;
}
export interface DayValue {
  day: string;
  value: number;
}
export interface DeviceDaily {
  steps: DayValue[];
  distanceKm: DayValue[];
  /** Hours asleep (asleep, light, deep, REM), overlaps merged, by local day of waking. */
  sleepHours: DayValue[];
  restingHeartRate: DayValue[];
  /** One series per method: never mixed (HealthKit: SDNN, Health Connect: RMSSD). */
  hrv: { method: 'SDNN' | 'RMSSD'; values: DayValue[] }[];
  platforms: ('healthkit' | 'health-connect')[];
  sources: string[];
}
const HRV_METHOD = { healthkit: 'SDNN', 'health-connect': 'RMSSD' } as const;
const sorted = (m: Map<string, number>) =>
  [...m].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value }));
function meanByDay(rows: DeviceRow[], zone: string) {
  const sums = new Map<string, [number, number]>();
  for (const r of rows) {
    const d = localDay(r.start, zone);
    const [s, n] = sums.get(d) ?? [0, 0];
    sums.set(d, [s + r.value, n + 1]);
  }
  return sorted(new Map([...sums].map(([d, [s, n]]) => [d, Math.round((s / n) * 10) / 10])));
}
/**
 * Daily totals of steps and distance are the platform's own (deduplicated across devices).
 * When several totals exist for one day (an earlier import of a day still in progress, or
 * two phones), the largest is kept: a cumulative daily total only grows, and adding them
 * would count the same steps twice.
 */
function dailyTotal(rows: DeviceRow[], zone: string, scale = 1) {
  const best = new Map<string, number>();
  for (const r of rows) {
    const d = localDay(r.start, zone);
    best.set(d, Math.max(best.get(d) ?? 0, r.value * scale));
  }
  return sorted(new Map([...best].map(([d, v]) => [d, Math.round(v * 100) / 100])));
}
/** Union of asleep intervals (several sources or stages overlap), credited to the waking day. */
function sleepByDay(rows: DeviceRow[], zone: string) {
  const intervals = rows
    .filter((r) => r.sleepState && ASLEEP.includes(r.sleepState))
    .map((r) => [Date.parse(r.start), Date.parse(r.end)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of intervals) {
    const last = merged.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const minutes = new Map<string, number>();
  for (const [a, b] of merged) {
    const d = localDay(new Date(b).toISOString(), zone);
    minutes.set(d, (minutes.get(d) ?? 0) + (b - a) / 60_000);
  }
  return sorted(new Map([...minutes].map(([d, m]) => [d, Math.round((m / 60) * 100) / 100])));
}
export function deviceDaily(rows: DeviceRow[], zone: string): DeviceDaily | null {
  if (!rows.length) return null;
  const of = (type: string) => rows.filter((r) => r.type === type);
  const hrv = (['healthkit', 'health-connect'] as const)
    .map((p) => ({
      method: HRV_METHOD[p],
      values: meanByDay(
        of('heartRateVariability').filter((r) => r.platform === p),
        zone,
      ),
    }))
    .filter((s) => s.values.length);
  return {
    steps: dailyTotal(
      of('steps').filter((r) => r.aggregation === 'daily-total'),
      zone,
    ),
    distanceKm: dailyTotal(
      of('distance').filter((r) => r.aggregation === 'daily-total'),
      zone,
      1 / 1000,
    ),
    sleepHours: sleepByDay(of('sleep'), zone),
    restingHeartRate: meanByDay(of('restingHeartRate'), zone),
    hrv,
    platforms: [...new Set(rows.map((r) => r.platform))].sort(),
    sources: [...new Set(rows.map((r) => r.sourceName).filter((s): s is string => !!s))].sort(),
  };
}
