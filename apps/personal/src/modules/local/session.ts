'use client';
import { IndexedKeyValue } from './kv';
import { LocalStore } from './store';
import { createVault, hasVault, openVault } from './vault';
/**
 * Launch mode « données sur le téléphone » (19 November 2026), chosen at build time for the
 * mobile app (scripts/build-mobile.ts). The website keeps the demonstration with fictitious
 * profiles. The unlocked store lives only in memory and is dropped when the app locks.
 */
export const DEVICE_RUNTIME = process.env.NEXT_PUBLIC_HC_RUNTIME === 'device';
const kv = new IndexedKeyValue();
let current: LocalStore | null = null;
const listeners = new Set<() => void>();
export const vaultExists = () => hasVault(kv);
export function deviceStore() {
  if (!current) throw Error('LOCKED');
  return current;
}
export const isUnlocked = () => current !== null;
export async function unlock(code: string) {
  current = new LocalStore(await openVault(kv, code));
  return current;
}
export async function create(code: string) {
  current = new LocalStore(await createVault(kv, code));
  return current;
}
export function lock() {
  current = null;
  for (const l of listeners) l();
}
export function onLock(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Erases the vault and the app's own preferences on this device. */
export async function eraseEverything() {
  await kv.clear();
  try {
    localStorage.clear();
  } catch {}
  lock();
}
