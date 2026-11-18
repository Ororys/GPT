export interface ChartPoint {
  date: string;
  value: number | null;
  id?: string;
}
// O(n) lookups after the shared sorted time axis. Never fill missing measurements.
export function prepareChartData(series: { points: ChartPoint[] }[]) {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const lookups = series.map((s) => new Map(s.points.map((p) => [p.date, p])));
  const intraday = dates.length > 1 && dates.every((d) => d.slice(0, 10) === dates[0].slice(0, 10));
  return { dates, lookups, intraday };
}
