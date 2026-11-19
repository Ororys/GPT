import { biomarkers } from '../health-records/fixtures';
import type { Biomarker, HealthDocument, HealthRecord, Observation } from '../health-records/model';
import type { AiCandidate } from '../ai/candidates';
import { AI_METHOD, AI_NOTICE_VERSION, AI_PROVIDER } from '../ai/contract';
import type { ConsentState } from '../consent/model';
import { DeviceImportSchema, type DeviceSampleInput } from '../device/model';
import { deviceDaily, type DeviceRow } from '../device/daily';
import { DEFAULT_TIME_ZONE } from '../observations/time';
import type { Vault } from './vault';
/**
 * The record kept on the phone (launch decision of 19 November 2026): no server receives
 * health data. Rules carried over from the database: permission required per source,
 * versioned permission decisions, idempotent phone imports, PDF bytes kept unchanged.
 * Unlike the hosted version, the person can delete anything: it is their own device (RGPD
 * art. 17), and « Supprimer toutes mes données » erases the vault itself.
 */
export const LOCAL_PERSON = 'device-owner';
/** Version of the information text accepted at first launch; bump when the text changes. */
export const NOTICE_VERSION = '2026-11-19';
/** 'ai-reading': sending a filed PDF to an online AI that transcribes its values (sprint 24). */
export const LOCAL_SOURCES = ['device-health', 'pdf-documents', 'ai-reading'] as const;
export type LocalSource = (typeof LOCAL_SOURCES)[number];
export type LocalConsentState = Omit<ConsentState, 'source'> & { source: LocalSource };
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export interface Onboarding {
  adultDeclared: true;
  noticeVersion: string;
  acceptedAt: string;
  firstName: string;
}
export interface StoredDocument {
  id: string;
  title: string;
  kind: 'biology' | 'report';
  date: string;
  addedAt: string;
  origin: string;
  pages: number;
  size: number;
  sha256: string;
}
type StoredRow = DeviceRow & { key: string; receivedAt: string };
const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async (bytes: Uint8Array) =>
  hex(await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource));
async function sampleKey(platform: string, s: DeviceSampleInput) {
  const text = [
    platform,
    s.dataType,
    s.aggregation ?? 'sample',
    s.sleepState ?? '',
    s.sourceId ?? '',
    s.startDate,
    s.endDate,
    s.value,
  ].join('\n');
  return sha256(new TextEncoder().encode(text));
}
/** Chunked: spreading megabytes of bytes into one call would overflow the stack. */
export function toBase64(bytes: Uint8Array) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'VS';
export class LocalStore {
  constructor(
    readonly vault: Vault,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async completeOnboarding(firstName: string) {
    const value: Onboarding = {
      adultDeclared: true,
      noticeVersion: NOTICE_VERSION,
      acceptedAt: this.now().toISOString(),
      firstName: firstName.trim().slice(0, 40),
    };
    await this.vault.put('onboarding', value);
    return value;
  }
  onboarding() {
    return this.vault.read<Onboarding>('onboarding');
  }
  // ---- Permissions (RGPD art. 7): versioned, withdrawable, never granted by default.
  private async history(source: LocalSource) {
    return (await this.vault.read<ConsentState['history']>(`consent/${source}`)) ?? [];
  }
  async consents(): Promise<LocalConsentState[]> {
    return Promise.all(
      LOCAL_SOURCES.map(async (source) => {
        const history = await this.history(source);
        const last = history.at(-1);
        return { source, granted: !!last?.granted, version: last?.version ?? 0, history };
      }),
    );
  }
  /**
   * Records a decision. On withdrawal, `erase` also deletes what this source brought
   * (RGPD art. 17.1.b); without it, the data stays and no new data is accepted.
   */
  async setConsent(source: LocalSource, expectedVersion: number, granted: boolean, erase = false) {
    if (!LOCAL_SOURCES.includes(source)) throw Error('INVALID_CONSENT');
    const history = await this.history(source);
    const version = history.at(-1)?.version ?? 0;
    if (version !== expectedVersion) throw Error('CONSENT_CONFLICT');
    history.push({
      version: version + 1,
      granted,
      decidedBy: 'vous',
      decidedAt: this.now().toISOString(),
    });
    await this.vault.put(`consent/${source}`, history);
    if (!granted && erase) await this.eraseSource(source);
    return { version: version + 1, granted };
  }
  private async requireConsent(source: LocalSource) {
    if (!(await this.history(source)).at(-1)?.granted) throw Error('CONSENT_REQUIRED');
  }
  async eraseSource(source: LocalSource) {
    const prefixes =
      source === 'device-health'
        ? ['device/', 'device-index']
        : source === 'pdf-documents'
          ? ['doc/', 'pdf/', 'obs/', 'custom-biomarkers', 'ai-log/']
          : // Every value in this record was transcribed by the AI from a PDF.
            ['obs/', 'custom-biomarkers', 'ai-log/'];
    for (const prefix of prefixes)
      for (const key of await this.vault.kv.keys(prefix)) await this.vault.kv.delete(key);
  }
  // ---- Phone data: same validation as the server route, idempotent by record key.
  async importDevice(input: unknown) {
    await this.requireConsent('device-health');
    const parsed = DeviceImportSchema.safeParse(input);
    if (!parsed.success) throw Error('INVALID_DEVICE_DATA');
    const limit = this.now().getTime() + 5 * 60_000;
    if (parsed.data.samples.some((s) => Date.parse(s.endDate) > limit))
      throw Error('INVALID_DEVICE_DATA');
    let inserted = 0,
      duplicates = 0;
    // Entry names are random: a digest of a few phone values could be guessed back from the
    // readable key. The digests used for idempotence stay inside the encrypted index.
    const seen = new Set((await this.vault.read<string[]>('device-index')) ?? []);
    for (const s of parsed.data.samples) {
      const key = await sampleKey(parsed.data.platform, s);
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      const row: StoredRow = {
        key,
        platform: parsed.data.platform,
        type: s.dataType,
        start: new Date(s.startDate).toISOString(),
        end: new Date(s.endDate).toISOString(),
        value: s.value,
        unit: s.unit,
        sleepState: s.sleepState ?? null,
        aggregation: s.aggregation,
        sourceName: s.sourceName ?? null,
        receivedAt: this.now().toISOString(),
      };
      await this.vault.put(`device/${globalThis.crypto.randomUUID()}`, row);
      inserted++;
    }
    await this.vault.put('device-index', [...seen]);
    return { inserted, duplicates };
  }
  async deviceRows() {
    const rows: StoredRow[] = [];
    for (const key of await this.vault.kv.keys('device/'))
      rows.push((await this.vault.read<StoredRow>(key))!);
    return rows;
  }
  // ---- PDF documents: kept as received, values are not read (no extraction yet).
  async addPdf(input: {
    bytes: Uint8Array;
    title: string;
    kind: 'biology' | 'report';
    date: string;
    origin?: string;
    pages: number;
  }) {
    await this.requireConsent('pdf-documents');
    const { bytes } = input;
    if (bytes.byteLength > MAX_PDF_BYTES) throw Error('PAYLOAD_TOO_LARGE');
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw Error('INVALID_PDF');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)))
      throw Error('INVALID_DATE');
    const title = input.title.trim().slice(0, 120);
    if (!title) throw Error('INVALID_TITLE');
    const digest = await sha256(bytes);
    for (const doc of await this.documents())
      if (doc.sha256 === digest) return { document: doc, duplicate: true };
    const document: StoredDocument = {
      id: `pdf-${globalThis.crypto.randomUUID()}`,
      title,
      kind: input.kind,
      date: input.date,
      addedAt: this.now().toISOString(),
      origin: (input.origin ?? '').trim().slice(0, 120),
      pages: Math.max(0, Math.floor(input.pages)),
      size: bytes.byteLength,
      sha256: digest,
    };
    await this.vault.putBytes(`pdf/${document.id}`, bytes);
    await this.vault.put(`doc/${document.id}`, document);
    return { document, duplicate: false };
  }
  async documents() {
    const docs: StoredDocument[] = [];
    for (const key of await this.vault.kv.keys('doc/'))
      docs.push((await this.vault.read<StoredDocument>(key))!);
    return docs.sort((a, b) => b.date.localeCompare(a.date) || b.addedAt.localeCompare(a.addedAt));
  }
  async pdfBytes(id: string) {
    const bytes = await this.vault.readBytes(`pdf/${id}`);
    if (!bytes) throw Error('NOT_FOUND');
    return bytes;
  }
  async deleteDocument(id: string) {
    if (!(await this.vault.kv.get(`doc/${id}`))) throw Error('NOT_FOUND');
    for (const [key, o] of await this.storedObservations())
      if (o.sourceId === id) await this.vault.kv.delete(key);
    await this.vault.kv.delete(`ai-log/${id}`);
    await this.vault.kv.delete(`pdf/${id}`);
    await this.vault.kv.delete(`doc/${id}`);
  }
  // ---- Values transcribed by the AI: only the lines the person selected, still « à
  // vérifier », confidence absent, printed value and unit kept (sprint 24).
  private async storedObservations() {
    const list: [string, Observation][] = [];
    for (const key of await this.vault.kv.keys('obs/'))
      list.push([key, (await this.vault.read<Observation>(key))!]);
    return list;
  }
  private async customBiomarkers() {
    return (await this.vault.read<Biomarker[]>('custom-biomarkers')) ?? [];
  }
  async addAiObservations(input: {
    documentId: string;
    candidates: AiCandidate[];
    selected: string[];
    model: string;
  }) {
    await this.requireConsent('pdf-documents');
    await this.requireConsent('ai-reading');
    const doc = await this.vault.read<StoredDocument>(`doc/${input.documentId}`);
    if (!doc) throw Error('NOT_FOUND');
    const chosen = input.candidates.filter((c) => input.selected.includes(c.id));
    if (!chosen.length || chosen.some((c) => c.blocked || c.value === null))
      throw Error('INVALID_SELECTION');
    const existing = await this.storedObservations();
    // Same document read twice: never a second copy of the same line.
    const already = new Set(
      existing
        .filter(([, o]) => o.sourceId === doc.id)
        .map(([, o]) => `${o.code}|${o.evidence.page}|${o.evidence.originalValue}`),
    );
    const custom = await this.customBiomarkers();
    const at = this.now().toISOString();
    let inserted = 0,
      duplicates = 0;
    for (const c of chosen) {
      if (already.has(`${c.code}|${c.page}|${c.value}`)) {
        duplicates++;
        continue;
      }
      if (c.newBiomarker && !custom.some((b) => b.code === c.code)) custom.push(c.newBiomarker);
      const observation: Observation = {
        id: `obs-${globalThis.crypto.randomUUID()}`,
        personId: LOCAL_PERSON,
        synthetic: false,
        code: c.code,
        value: c.value!,
        unit: c.unit,
        measuredAt: `${doc.date}T00:00:00Z`,
        measuredPrecision: 'day',
        knownAt: at,
        method: 'lab_method_not_reported',
        sourceId: doc.id,
        quality: 'needs-review',
        evidence: {
          documentId: doc.id,
          page: c.page,
          sourceText: `${c.label} ${c.printedValue} ${c.originalUnit}`.trim().slice(0, 200),
          method: 'ai-transcription',
          validation: 'needs-review',
          processedAt: at,
          confidence: null,
          originalValue: c.value!,
          originalUnit: c.originalUnit,
        },
        ...(c.reference ? { reference: c.reference } : {}),
      };
      await this.vault.put(`obs/${globalThis.crypto.randomUUID()}`, observation);
      inserted++;
    }
    await this.vault.put('custom-biomarkers', custom);
    const log = (await this.vault.read<object[]>(`ai-log/${doc.id}`)) ?? [];
    log.push({
      provider: AI_PROVIDER,
      model: input.model,
      method: AI_METHOD,
      noticeVersion: AI_NOTICE_VERSION,
      at,
      inserted,
    });
    await this.vault.put(`ai-log/${doc.id}`, log);
    return { inserted, duplicates };
  }
  // ---- Read model shared with the screens.
  async record(): Promise<HealthRecord> {
    const onboarding = await this.onboarding();
    const name = onboarding?.firstName || 'Vous';
    const documents: HealthDocument[] = (await this.documents()).map((d) => ({
      id: d.id,
      personId: LOCAL_PERSON,
      title: d.title,
      kind: d.kind,
      // Day-precision date: anchored at midnight UTC, never shifted (C-01).
      date: `${d.date}T00:00:00Z`,
      datePrecision: 'day',
      knownAt: d.addedAt,
      laboratory: d.origin || 'Origine non renseignée',
      pages: d.pages,
      status: 'available',
      synthetic: false,
    }));
    const observations = (await this.storedObservations()).map(([, o]) => o);
    const custom = await this.customBiomarkers();
    return {
      personId: LOCAL_PERSON,
      timeZone: DEFAULT_TIME_ZONE,
      device: deviceDaily(await this.deviceRows(), DEFAULT_TIME_ZONE),
      synthetic: false,
      storage: 'device',
      asOf: this.now().toISOString(),
      profile: { firstName: name, initials: initials(name), description: 'Sur ce téléphone' },
      // Only parameters that have values here: nothing shown empty or invented.
      biomarkers: [...biomarkers, ...custom].filter((b) =>
        observations.some((o) => o.code === b.code),
      ),
      observations,
      documents,
      activities: [],
      sleep: [],
      events: [],
    };
  }
  /** Right of access and portability (art. 15, 20): everything stored, PDFs included. */
  async exportAll() {
    const documents = [];
    for (const d of await this.documents())
      documents.push({ ...d, pdfBase64: toBase64(await this.pdfBytes(d.id)) });
    return {
      format: 'convergence-export',
      version: 1,
      mode: 'device',
      generatedAt: this.now().toISOString(),
      onboarding: await this.onboarding(),
      record: await this.record(),
      consents: await this.consents(),
      documents,
      deviceRows: await this.deviceRows(),
    };
  }
  /** Erases everything, encryption key included: nothing can be recovered afterwards. */
  async deleteAll() {
    await this.vault.kv.clear();
  }
}
