export function storageMode(): 'postgres' | 'local' {
  const mode = process.env.HC_PERSONAL_STORAGE ?? 'postgres';
  if (mode !== 'postgres' && mode !== 'local') throw Error('INVALID_STORAGE_CONFIGURATION');
  return mode;
}
