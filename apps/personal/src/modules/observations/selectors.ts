import { type HealthRecord, type Observation, DEMO_NOW } from '../health-records/model';
import { DEFAULT_TIME_ZONE } from './time';
export const dateLabel = (
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) => new Date(iso).toLocaleDateString('fr-FR', { ...options, timeZone: DEFAULT_TIME_ZONE });
export function withinPeriod(date: string, period: number, asOf = DEMO_NOW) {
  const t = Date.parse(date),
    end = Date.parse(asOf);
  return Number.isFinite(t) && t <= end && (period === 0 || t >= end - period * 86400000);
}
export function latest(observations: Observation[], code: string) {
  return observations
    .filter((o) => o.code === code)
    .toSorted((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
}
export function activitySummary(record: HealthRecord, period: number) {
  const rows = record.activities.filter((a) => withinPeriod(a.date, period, record.asOf));
  return {
    count: rows.length,
    distanceKm: Math.round(rows.reduce((n, a) => n + a.distanceKm, 0) * 10) / 10,
    durationMinutes: rows.reduce((n, a) => n + a.durationMinutes, 0),
    rows,
  };
}
export function mean(values: number[]) {
  return values.length ? values.reduce((s, n) => s + n, 0) / values.length : null;
}
export function sleepSummary(record: HealthRecord, period: number) {
  const rows = record.sleep.filter((a) => withinPeriod(a.date, period, record.asOf));
  return {
    count: rows.length,
    hours: mean(rows.map((r) => r.durationHours)),
    restingHeartRate: mean(rows.map((r) => r.restingHeartRate)),
    hrv: mean(rows.map((r) => r.hrv)),
  };
}
export function knownAt(record: HealthRecord, cutoff: string): HealthRecord {
  const visible = (x: { date: string; knownAt: string }) => x.date <= cutoff && x.knownAt <= cutoff;
  return {
    ...record,
    asOf: cutoff,
    documents: record.documents.filter(visible),
    observations: record.observations
      .filter((o) => o.measuredAt <= cutoff && o.knownAt <= cutoff)
      .map((o) => valueKnownAt(o, cutoff)),
    activities: record.activities.filter(visible),
    sleep: record.sleep.filter(visible),
    events: record.events.filter(visible),
  };
}
/**
 * Time Machine for corrections: a correction is known from `correctedAt`. Before that
 * moment the value read from the source (or the earlier version) is the one shown.
 */
export function valueKnownAt(o: Observation, cutoff: string): Observation {
  if (!o.corrections?.length) return o;
  const known = o.corrections.filter((c) => c.correctedAt <= cutoff);
  if (known.length === o.corrections.length) return o;
  const { corrections: _later, ...rest } = o;
  return known.length
    ? { ...rest, value: known[known.length - 1].value, corrections: known }
    : { ...rest, value: o.evidence.originalValue };
}
