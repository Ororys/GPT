/**
 * Calendar-day rule (C-01). A day is the calendar date in the dossier's IANA time zone,
 * so a night or an evening measurement belongs to the local day it happened on, with
 * daylight-saving changes handled by the zone database. A value known only to the day
 * (laboratory date, measuredPrecision='day') keeps its calendar date and is never shifted.
 *
 * Health Connect stores an instant plus a zone offset per record for the same reason; the
 * demo has no device offsets, so the dossier zone stands in for them. Default: Europe/Paris
 * (centre in Bordeaux).
 */
export const DEFAULT_TIME_ZONE = 'Europe/Paris';
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}
/** YYYY-MM-DD of an instant in the given zone. Throws on an unknown zone. */
export function localDay(iso: string, timeZone = DEFAULT_TIME_ZONE) {
  return formatter(timeZone).format(new Date(iso));
}
export function dayOf(
  value: { measuredAt: string; measuredPrecision?: 'day' | 'instant' },
  timeZone = DEFAULT_TIME_ZONE,
) {
  return value.measuredPrecision === 'day'
    ? value.measuredAt.slice(0, 10)
    : localDay(value.measuredAt, timeZone);
}
export const zoneOf = (record: { timeZone?: string }) => record.timeZone ?? DEFAULT_TIME_ZONE;
/** Calendar arithmetic on YYYY-MM-DD strings, independent of any zone. */
export function addDays(day: string, n: number) {
  return new Date(Date.parse(day + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
}
/** Monday of the ISO week containing the calendar day. */
export function weekStart(day: string) {
  const d = new Date(day + 'T00:00:00Z');
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}
