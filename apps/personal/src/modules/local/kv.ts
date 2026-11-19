/**
 * Minimal key-value storage used by the on-device record (launch mode « données sur le
 * téléphone »). Values are opaque: the vault encrypts everything before it reaches here.
 */
export interface KeyValue {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  /** Removes every entry, including the vault: used by « Supprimer toutes mes données ». */
  clear(): Promise<void>;
}
export class MemoryKeyValue implements KeyValue {
  readonly map = new Map<string, unknown>();
  async get(key: string) {
    return structuredClone(this.map.get(key));
  }
  async set(key: string, value: unknown) {
    this.map.set(key, structuredClone(value));
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async keys(prefix = '') {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
  async clear() {
    this.map.clear();
  }
}
const DB = 'convergence-device';
const STORE = 'kv';
/** IndexedDB in the app's WebView (or a browser). Stays on the device. */
export class IndexedKeyValue implements KeyValue {
  private db: Promise<IDBDatabase> | null = null;
  private open() {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }
  private async run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>) {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  get(key: string) {
    return this.run('readonly', (s) => s.get(key));
  }
  async set(key: string, value: unknown) {
    await this.run('readwrite', (s) => s.put(value, key));
  }
  async delete(key: string) {
    await this.run('readwrite', (s) => s.delete(key));
  }
  async keys(prefix = '') {
    const all = (await this.run('readonly', (s) => s.getAllKeys())) as string[];
    return all.filter((k) => k.startsWith(prefix)).sort();
  }
  async clear() {
    await this.run('readwrite', (s) => s.clear());
  }
}
