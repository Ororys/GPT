import type { HealthRecord } from '../health-records/model';
import { withinPeriod } from '../observations/selectors';
import { addDays, localDay, zoneOf } from '../observations/time';
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
  | 'SEVERAL_PROTOCOLS'
  | 'DEVICE_ESTIMATE_BIA';
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
/** Longest run of local calendar days without data, window ending on the local day of asOf. */
export function longestGap(
  dates: string[],
  asOf: string,
  windowDays: number,
  timeZone?: string,
): Gap | null {
  const end = localDay(asOf, timeZone);
  const present = new Set(dates.map((d) => localDay(d, timeZone)));
  let best: Gap | null = null;
  let runStart: string | null = null;
  let runDays = 0;
  for (let i = windowDays - 1; i >= -1; i--) {
    const day = addDays(end, -i);
    const missing = i >= 0 && !present.has(day);
    if (missing) {
      runStart ??= day;
      runDays++;
    } else if (runStart) {
      if (!best || runDays > best.days)
        best = { from: runStart, to: addDays(day, -1), days: runDays };
      runStart = null;
      runDays = 0;
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
  const zone = zoneOf(record);
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
    // ESPEN 2004 (Kyle et al., Clin Nutr 23:1430): BIA not validated at extreme BMI or
    // abnormal hydration. Stated as a technical limit, never as a reading of the value.
    if (b.code === 'BODY_FAT') notes.push('DEVICE_ESTIMATE_BIA');
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
      daysWithData: new Set(rows.map((r) => localDay(r.date, zone))).size,
      longestGap: gaps
        ? longestGap(
            rows.map((r) => r.date),
            record.asOf,
            windowDays,
            zone,
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
