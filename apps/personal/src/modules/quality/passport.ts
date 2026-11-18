import type { HealthRecord } from '../health-records/model';
import { withinPeriod } from '../observations/selectors';
/**
 * Quality passport (R12): where each series comes from, how it was obtained, how complete
 * it is and what makes values non-comparable. Technical facts only, never a medical reading.
 */
export type ComparabilityNote =
  | 'MIXED_UNITS'
  | 'SEVERAL_LABORATORIES'
  | 'SEVERAL_DEVICES'
  | 'MANUFACTURER_ESTIMATE'
  | 'HRV_METHOD_SPECIFIC'
  | 'ANALYTICAL_METHOD_NOT_REPORTED'
  | 'SEVERAL_PROTOCOLS';
export interface Gap {
  from: string;
  to: string;
  days: number;
}
export interface BiologyPassport {
  code: string;
  label: string;
  category: string;
  count: number;
  first: string | null;
  last: string | null;
  units: string[];
  laboratories: string[];
  documents: number;
  acquisition: { method: string; count: number }[];
  /** Measurement method or protocol as stated on each value. */
  protocols: string[];
  needsReview: number;
  corrected: number;
  notes: ComparabilityNote[];
}
export interface DailyPassport {
  id: 'resting-heart-rate' | 'sleep-duration' | 'hrv' | 'activities';
  label: string;
  unit: string;
  devices: string[];
  windowDays: number;
  /** Distinct days with at least one value inside the window. */
  daysWithData: number;
  /** Null for activities: a day without a recorded activity is not missing data. */
  longestGap: Gap | null;
  notes: ComparabilityNote[];
}
export interface QualityPassport {
  asOf: string;
  biology: BiologyPassport[];
  daily: DailyPassport[];
}
const DAY = 86_400_000;
const dayOf = (iso: string) => iso.slice(0, 10);
/** Longest run of calendar days without data inside [asOf - window, asOf]. */
export function longestGap(dates: string[], asOf: string, windowDays: number): Gap | null {
  const end = Date.parse(dayOf(asOf) + 'T00:00:00Z');
  const start = end - (windowDays - 1) * DAY;
  const present = new Set(dates.map(dayOf));
  let best: Gap | null = null;
  let runStart: number | null = null;
  for (let t = start; t <= end + DAY; t += DAY) {
    const missing = t <= end && !present.has(new Date(t).toISOString().slice(0, 10));
    if (missing && runStart === null) runStart = t;
    if (!missing && runStart !== null) {
      const days = (t - runStart) / DAY;
      if (!best || days > best.days)
        best = {
          from: new Date(runStart).toISOString().slice(0, 10),
          to: new Date(t - DAY).toISOString().slice(0, 10),
          days,
        };
      runStart = null;
    }
  }
  return best;
}
const ACQUISITION: Record<string, string> = {
  'synthetic-fixture': 'Jeu synthétique',
  'structured-import': 'Import structuré',
  'native-pdf': 'Texte PDF natif',
  'device-export': 'Export d’appareil',
  declared: 'Déclaré',
};
export function qualityPassport(record: HealthRecord, windowDays = 90): QualityPassport {
  const biology = record.biomarkers.map((b): BiologyPassport => {
    const rows = record.observations
      .filter((o) => o.code === b.code)
      .toSorted((a, z) => a.measuredAt.localeCompare(z.measuredAt));
    const units = [...new Set(rows.map((o) => o.unit))];
    const laboratories = [
      ...new Set(
        rows.map(
          (o) =>
            o.reference?.laboratory ??
            record.documents.find((d) => d.id === o.sourceId)?.laboratory ??
            'Laboratoire non identifié',
        ),
      ),
    ];
    const methods = new Map<string, number>();
    for (const o of rows) {
      const m = ACQUISITION[o.evidence.method] ?? o.evidence.method;
      methods.set(m, (methods.get(m) ?? 0) + 1);
    }
    const notes: ComparabilityNote[] = [];
    if (units.length > 1) notes.push('MIXED_UNITS');
    if (laboratories.length > 1) notes.push('SEVERAL_LABORATORIES');
    if (rows.some((o) => o.method === 'lab_method_not_reported'))
      notes.push('ANALYTICAL_METHOD_NOT_REPORTED');
    const protocols = [
      ...new Set(rows.map((o) => o.method).filter((m) => m !== 'lab_method_not_reported')),
    ];
    if (protocols.length > 1) notes.push('SEVERAL_PROTOCOLS');
    return {
      code: b.code,
      label: b.label,
      category: b.category,
      count: rows.length,
      first: rows[0]?.measuredAt ?? null,
      last: rows.at(-1)?.measuredAt ?? null,
      units,
      laboratories,
      documents: new Set(rows.map((o) => o.sourceId)).size,
      acquisition: [...methods].map(([method, count]) => ({ method, count })),
      protocols,
      needsReview: rows.filter((o) => o.quality === 'needs-review').length,
      corrected: rows.filter((o) => o.corrections?.length).length,
      notes,
    };
  });
  const recent = <T extends { date: string }>(rows: T[]) =>
    rows.filter((r) => withinPeriod(r.date, windowDays, record.asOf));
  const nights = recent(record.sleep);
  const activities = recent(record.activities);
  const series = (
    id: DailyPassport['id'],
    label: string,
    unit: string,
    rows: { date: string; device: string }[],
    extra: ComparabilityNote[] = [],
    gaps = true,
  ): DailyPassport => {
    const devices = [...new Set(rows.map((r) => r.device))];
    const notes: ComparabilityNote[] = [];
    if (rows.length) notes.push('MANUFACTURER_ESTIMATE', ...extra);
    if (devices.length > 1) notes.push('SEVERAL_DEVICES');
    return {
      id,
      label,
      unit,
      devices,
      windowDays,
      daysWithData: new Set(rows.map((r) => dayOf(r.date))).size,
      longestGap: gaps
        ? longestGap(
            rows.map((r) => r.date),
            record.asOf,
            windowDays,
          )
        : null,
      notes,
    };
  };
  return {
    asOf: record.asOf,
    biology,
    daily: [
      series('resting-heart-rate', 'FC au repos', 'bpm', nights),
      series('sleep-duration', 'Durée de sommeil', 'h', nights),
      series(
        'hrv',
        `VFC (${[...new Set(nights.map((n) => n.method))].join(', ') || 'méthode inconnue'})`,
        'ms',
        nights,
        ['HRV_METHOD_SPECIFIC'],
      ),
      series('activities', 'Activités', 'km', activities, [], false),
    ],
  };
}
