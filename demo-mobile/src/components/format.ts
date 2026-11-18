export const number = (n: number, decimals = 0) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export function duration(minutes: number) {
  return `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')}`;
}
export function hours(value: number | null) {
  return value === null ? '—' : duration(Math.round(value * 60));
}
