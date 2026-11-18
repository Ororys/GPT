import type { HealthRecord, Observation } from '../health-records/model';
import { mean, withinPeriod } from '../observations/selectors';
import { localDay, zoneOf } from '../observations/time';
import type { DayValue } from '../device/daily';
/**
 * Factual, sourced summary to prepare a consultation. Selection and counting only:
 * no trend wording, no thresholds, no interpretation, no score.
 */
export interface SummaryValue {
  date: string;
  value: number;
  unit: string;
  documentTitle: string;
  documentId: string;
  page: number;
  needsReview: boolean;
  /** Present when the value in force differs from the value read in the source. */
  correction: { version: number; originalValue: number } | null;
  reference: { low: number; high: number; laboratory: string } | null;
}
export interface SummaryMarker {
  code: string;
  label: string;
  category: string;
  /** Distinct measurement protocols or methods stated on the values. */
  methods: string[];
  values: SummaryValue[];
  /** Several units for one parameter: values are listed, never converted or compared. */
  mixedUnits: boolean;
}
export interface ConsultationSummary {
  asOf: string;
  periodDays: number;
  from: string;
  markers: SummaryMarker[];
  missing: string[];
  sleep: {
    nights: number;
    days: number;
    meanHours: number | null;
    meanRestingHeartRate: number | null;
    meanHrv: number | null;
    hrvMethods: string[];
    devices: string[];
  };
  activities: { count: number; distanceKm: number; durationMinutes: number; devices: string[] };
  events: { date: string; title: string; kind: string }[];
  quality: { needsReview: number; corrected: number; documents: number };
  /** Phone data (Santé / Health Connect), kept apart from the wearable demo series. */
  phone: {
    platforms: string[];
    series: { label: string; unit: string; days: number; mean: number | null; note?: string }[];
  } | null;
}
export const SUMMARY_PERIODS = [90, 365, 730] as const;
const DAY = 86_400_000;
export function consultationSummary(record: HealthRecord, periodDays: number): ConsultationSummary {
  if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 3650)
    throw Error('INVALID_PERIOD');
  const asOf = record.asOf;
  const from = new Date(Date.parse(asOf) - periodDays * DAY).toISOString();
  const inPeriod = (date: string) => withinPeriod(date, periodDays, asOf);
  const observations = record.observations.filter((o) => inPeriod(o.measuredAt));
  const value = (o: Observation): SummaryValue => {
    const doc = record.documents.find((d) => d.id === o.sourceId);
    const corrections = o.corrections ?? [];
    return {
      date: o.measuredAt,
      value: o.value,
      unit: o.unit,
      documentTitle: doc?.title ?? 'Document non retrouvé',
      documentId: o.sourceId,
      page: o.evidence.page,
      needsReview: o.quality === 'needs-review',
      correction: corrections.length
        ? { version: corrections.length, originalValue: o.evidence.originalValue }
        : null,
      reference: o.reference
        ? { low: o.reference.low, high: o.reference.high, laboratory: o.reference.laboratory }
        : null,
    };
  };
  const markers: SummaryMarker[] = [];
  const missing: string[] = [];
  for (const b of record.biomarkers) {
    const rows = observations
      .filter((o) => o.code === b.code)
      .toSorted((a, z) => a.measuredAt.localeCompare(z.measuredAt) || a.id.localeCompare(z.id))
      .map(value);
    if (!rows.length) missing.push(b.label);
    else
      markers.push({
        code: b.code,
        label: b.label,
        category: b.category,
        methods: [...new Set(observations.filter((o) => o.code === b.code).map((o) => o.method))],
        values: rows,
        mixedUnits: new Set(rows.map((r) => r.unit)).size > 1,
      });
  }
  const nights = record.sleep.filter((s) => inPeriod(s.date));
  const activities = record.activities.filter((a) => inPeriod(a.date));
  const usedDocuments = new Set(observations.map((o) => o.sourceId));
  return {
    asOf,
    periodDays,
    from,
    markers,
    missing,
    sleep: {
      nights: new Set(nights.map((n) => localDay(n.date, zoneOf(record)))).size,
      days: periodDays,
      meanHours: mean(nights.map((n) => n.durationHours)),
      meanRestingHeartRate: mean(nights.map((n) => n.restingHeartRate)),
      meanHrv: mean(nights.map((n) => n.hrv)),
      hrvMethods: [...new Set(nights.map((n) => n.method))],
      devices: [...new Set(nights.map((n) => n.device))],
    },
    activities: {
      count: activities.length,
      distanceKm: Math.round(activities.reduce((n, a) => n + a.distanceKm, 0) * 10) / 10,
      durationMinutes: activities.reduce((n, a) => n + a.durationMinutes, 0),
      devices: [...new Set(activities.map((a) => a.device))],
    },
    events: record.events
      .filter((e) => inPeriod(e.date))
      .toSorted((a, z) => a.date.localeCompare(z.date))
      .map((e) => ({ date: e.date, title: e.title, kind: e.kind })),
    quality: {
      needsReview: observations.filter((o) => o.quality === 'needs-review').length,
      corrected: observations.filter((o) => o.corrections?.length).length,
      documents: usedDocuments.size,
    },
    phone: phoneSummary(record, from),
  };
}
/** Days with a value and mean of those days only; missing days are never filled. */
function phoneSummary(record: HealthRecord, from: string): ConsultationSummary['phone'] {
  const d = record.device;
  if (!d) return null;
  const start = localDay(from, zoneOf(record));
  const keep = (v: DayValue[]) => v.filter((x) => x.day >= start);
  const serie = (label: string, unit: string, v: DayValue[], note?: string) => {
    const rows = keep(v);
    return {
      label,
      unit,
      days: rows.length,
      mean: rows.length
        ? Math.round((rows.reduce((s, x) => s + x.value, 0) / rows.length) * 10) / 10
        : null,
      ...(note ? { note } : {}),
    };
  };
  const series = [
    serie('Temps endormi', 'h', d.sleepHours, 'au lit et éveils exclus, chevauchements fusionnés'),
    serie('FC au repos', 'bpm', d.restingHeartRate),
    ...d.hrv.map((h) => serie(`VFC ${h.method}`, 'ms', h.values, 'méthode propre à la plateforme')),
    serie('Pas par jour', 'pas', d.steps, 'total quotidien de la plateforme'),
    serie('Distance par jour', 'km', d.distanceKm, 'total quotidien de la plateforme'),
  ].filter((x) => x.days > 0);
  return series.length
    ? {
        platforms: d.platforms.map((p) =>
          p === 'healthkit' ? 'Santé (iPhone)' : 'Health Connect',
        ),
        series,
      }
    : null;
}
