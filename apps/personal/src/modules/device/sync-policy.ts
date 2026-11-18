/** Automatic phone sync at app start: only when allowed, at most every 6 hours. */
export const SYNC_EVERY_MS = 6 * 3600_000;
export const SYNC_KEY = 'convergence-phone-sync';
export function shouldAutoSync(options: {
  native: boolean;
  consentGranted: boolean;
  lastSync: string | null;
  now: number;
}) {
  if (!options.native || !options.consentGranted) return false;
  const last = options.lastSync ? Date.parse(options.lastSync) : NaN;
  // Unknown, unreadable or future timestamps: sync (never trust a clock in the future).
  return !Number.isFinite(last) || last > options.now || options.now - last >= SYNC_EVERY_MS;
}
