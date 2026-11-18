import 'server-only';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { baseRecord } from './fixtures';
import { type HealthRecord, PERSON_ALPHA } from './model';
import { ImportSchema, TEMPLATE_TEXT } from '../documents/import-contract';
import { localRoot } from '../audit/server';
// Explicit, local-only synthetic adapter. No silent fallback from PostgreSQL.
// Only the shipped fixture is accepted. Patient uploads belong to a later, reviewed pipeline.
const globalQueue = globalThis as typeof globalThis & { personalImportQueue?: Promise<unknown> };
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const receiptPath = (personId: string) => join(localRoot, `receipt-${personId}.json`);
export async function getRecord(personId: string): Promise<HealthRecord> {
  const record = baseRecord(personId);
  if (personId === PERSON_ALPHA) {
    try {
      const receipt = JSON.parse(await readFile(receiptPath(personId), 'utf8')) as {
        sha256: string;
      };
      if (receipt.sha256 !== digest(TEMPLATE_TEXT)) throw Error('INVALID_RECEIPT');
      record.observations.push(
        ...structuredClone(ImportSchema.parse(JSON.parse(TEMPLATE_TEXT)).observations),
      );
      record.documents.push({
        id: 'lab-2026-11-18',
        personId,
        synthetic: true,
        title: 'Bilan biologique · novembre 2026 (import)',
        date: '2026-11-18T08:15:00Z',
        knownAt: '2026-11-18T10:00:00Z',
        laboratory: 'Laboratoire Atlas · fictif',
        pages: 1,
        kind: 'biology',
        status: 'needs-review',
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  return record;
}
export async function importDemo(text: string, personId: string) {
  if (Buffer.byteLength(text) > 100_000) throw Error('PAYLOAD_TOO_LARGE');
  if (personId !== PERSON_ALPHA) throw Error('FORBIDDEN');
  // Exact bytes fence: never store arbitrary medical content, even if labelled synthetic.
  if (digest(text) !== digest(TEMPLATE_TEXT)) throw Error('INVALID_DEMO_FILE');
  const parsed = ImportSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw Error('INVALID_DEMO_FILE');
  const operation = (globalQueue.personalImportQueue ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await mkdir(localRoot, { recursive: true, mode: 0o700 });
      try {
        await readFile(receiptPath(personId));
        return { inserted: 0, duplicates: 1, sha256: digest(text) };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      const temporary = join(localRoot, `receipt-${randomUUID()}.tmp`);
      await writeFile(
        temporary,
        JSON.stringify({
          sha256: digest(text),
          batchId: parsed.data.batchId,
          importedAt: new Date().toISOString(),
        }),
        { mode: 0o600 },
      );
      await rename(temporary, receiptPath(personId));
      return { inserted: 1, duplicates: 0, sha256: digest(text) };
    });
  globalQueue.personalImportQueue = operation;
  return operation;
}
