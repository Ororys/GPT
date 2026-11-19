import type { KeyValue } from './kv';
/**
 * Encryption of the on-device record. A random AES-256-GCM data key encrypts every value;
 * that key is itself wrapped with a key derived from the user's code (PBKDF2-SHA-256).
 * Without the code, what is stored on the phone cannot be read. The code is never stored.
 * There is no recovery: a forgotten code means the data is lost (said on screen).
 */
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_CODE_LENGTH = 6;
const VAULT_KEY = 'vault';
interface VaultMeta {
  version: 1;
  salt: string;
  iv: string;
  wrapped: string;
  iterations: number;
}
const subtle = () => globalThis.crypto.subtle;
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));
export function validCode(code: string) {
  return /^\d+$/.test(code) && code.length >= MIN_CODE_LENGTH && code.length <= 12;
}
async function wrappingKey(code: string, salt: Uint8Array, iterations: number) {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}
export async function hasVault(kv: KeyValue) {
  return (await kv.get(VAULT_KEY)) !== undefined;
}
export async function createVault(kv: KeyValue, code: string, iterations = PBKDF2_ITERATIONS) {
  if (!validCode(code)) throw Error('INVALID_CODE');
  if (await hasVault(kv)) throw Error('VAULT_EXISTS');
  const salt = random(16);
  const iv = random(12);
  const key = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const wrapped = await subtle().wrapKey('raw', key, await wrappingKey(code, salt, iterations), {
    name: 'AES-GCM',
    iv: iv as BufferSource,
  });
  const meta: VaultMeta = {
    version: 1,
    salt: b64(salt),
    iv: b64(iv),
    wrapped: b64(new Uint8Array(wrapped)),
    iterations,
  };
  await kv.set(VAULT_KEY, meta);
  return openVault(kv, code);
}
/** Throws WRONG_CODE when the code does not unwrap the key (GCM authentication). */
export async function openVault(kv: KeyValue, code: string) {
  const meta = (await kv.get(VAULT_KEY)) as VaultMeta | undefined;
  if (!meta) throw Error('NO_VAULT');
  let key: CryptoKey;
  try {
    key = await subtle().unwrapKey(
      'raw',
      unb64(meta.wrapped) as BufferSource,
      await wrappingKey(code, unb64(meta.salt), meta.iterations),
      { name: 'AES-GCM', iv: unb64(meta.iv) as BufferSource },
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw Error('WRONG_CODE');
  }
  return new Vault(kv, key);
}
/** Encrypted view over the key-value storage; keys stay readable, values never do. */
export class Vault {
  constructor(
    readonly kv: KeyValue,
    private readonly key: CryptoKey,
  ) {}
  private async seal(bytes: Uint8Array, aad: string) {
    const iv = random(12);
    const data = await subtle().encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: new TextEncoder().encode(aad) },
      this.key,
      bytes as BufferSource,
    );
    return { iv: b64(iv), data: new Uint8Array(data) };
  }
  private async unseal(box: { iv: string; data: Uint8Array }, aad: string) {
    return new Uint8Array(
      await subtle().decrypt(
        {
          name: 'AES-GCM',
          iv: unb64(box.iv) as BufferSource,
          additionalData: new TextEncoder().encode(aad),
        },
        this.key,
        box.data as BufferSource,
      ),
    );
  }
  /** The entry name is authenticated: an encrypted value cannot be moved to another key. */
  async put(key: string, value: unknown) {
    await this.kv.set(key, await this.seal(new TextEncoder().encode(JSON.stringify(value)), key));
  }
  async read<T>(key: string): Promise<T | undefined> {
    const box = (await this.kv.get(key)) as { iv: string; data: Uint8Array } | undefined;
    if (!box) return undefined;
    return JSON.parse(new TextDecoder().decode(await this.unseal(box, key))) as T;
  }
  async putBytes(key: string, bytes: Uint8Array) {
    await this.kv.set(key, await this.seal(bytes, key));
  }
  async readBytes(key: string) {
    const box = (await this.kv.get(key)) as { iv: string; data: Uint8Array } | undefined;
    return box ? this.unseal(box, key) : undefined;
  }
}
