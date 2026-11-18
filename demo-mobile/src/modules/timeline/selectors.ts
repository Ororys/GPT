import type { HealthRecord, TimelineItem } from '../health-records/model';
export function timeline(record: HealthRecord): TimelineItem[] {
  return [
    ...record.documents.map((d) => ({
      id: d.id,
      date: d.date,
      knownAt: d.knownAt,
      title: d.title,
      detail: d.laboratory,
      kind: d.kind === 'biology' ? ('biology' as const) : ('document' as const),
      documentId: d.id,
    })),
    ...record.activities.map((a) => ({
      id: a.id,
      date: a.date,
      knownAt: a.knownAt,
      title: a.title,
      detail: `${a.distanceKm} km · ${a.durationMinutes} min · appareil de démonstration`,
      kind: 'sport' as const,
      activityId: a.id,
    })),
    ...record.events.map((e) => ({ ...e, detail: e.description })),
  ].toSorted((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
