import { getDocumentProxy, extractTextItems } from 'unpdf';
import { z } from 'zod';
import { biomarkers } from '../health-records/fixtures';
import {
  type HealthDocument,
  type Observation,
  PERSON_ALPHA,
  DEMO_NOW,
  ObservationSchema,
} from '../health-records/model';
import { identifyFixture, pdfDigest, type FixtureId } from './corpus';
/**
 * Blocking issues: a candidate carrying any of them is never eligible.
 * Notes are informative and never block, and never alter the value read.
 */
export type CandidateIssue =
  | 'UNIT_MISMATCH_NO_CONVERSION'
  | 'MEASUREMENT_DATE_MISSING'
  | 'MEASUREMENT_DATE_INVALID'
  | 'MEASUREMENT_DATE_AMBIGUOUS'
  | 'PATIENT_NOT_IDENTIFIED'
  | 'INVALID_VALUE'
  | 'VALUE_QUALIFIER_NOT_SUPPORTED'
  | 'VALUE_NOT_NUMERIC'
  | 'DUPLICATE_IN_DOCUMENT';
export type CandidateNote =
  'REFERENCE_ABSENT' | 'REFERENCE_NOT_STRUCTURED' | 'ROW_RECONSTRUCTED_FROM_COLUMNS';
export interface PdfCandidate {
  id: string;
  code: string;
  label: string;
  /** Null when the cell is not a plain number (e.g. "< 4"); never guessed. */
  value: number | null;
  unit: string;
  originalText: string;
  page: number;
  bounds: { x: number; y: number; width: number; height: number };
  eligible: boolean;
  issues: CandidateIssue[];
  notes?: CandidateNote[];
  observation: Observation | null;
}
/** A table-like line that was read but not turned into a candidate. */
export interface UnrecognizedLine {
  page: number;
  text: string;
}
/** Same parameter, same UTC day, another document. Informative only, never stored. */
export interface PdfOverlap {
  candidateId: string;
  matches: {
    observationId: string;
    documentId: string;
    documentTitle: string;
    value: number;
    unit: string;
  }[];
}
export interface PdfProposal {
  id: string;
  fixtureId: FixtureId;
  sha256: string;
  method: 'pdf-native-v1';
  datePrecision: 'day';
  pages: number;
  status: 'needs-review' | 'ocr-required';
  document: HealthDocument;
  candidates: PdfCandidate[];
  /** Absent on proposals staged before sprint 04. */
  unrecognized?: UnrecognizedLine[];
  warnings: string[];
}
const alias: Record<string, string> = {
  ferritine: 'FERRITIN',
  'ldl-cholesterol': 'LDL_C',
  hba1c: 'HBA1C',
  creatinine: 'CREATININE',
  'vitamine d': 'VITD',
  hemoglobine: 'HEMOGLOBIN',
};
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const NUMBER = /^-?\d+(?:[.,]\d+)?$/;
const RANGE = /^(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)$/;
const num = (s: string) => Number(s.replace(',', '.'));
interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface TextLine {
  page: number;
  /** Exact text when the line is a single run; cells joined by " | " otherwise. */
  text: string;
  cells: string[];
  runs: number;
  bounds: PdfCandidate['bounds'];
}
/**
 * Groups text runs sharing a baseline (±2 pt) into lines, top to bottom, left to right.
 * A single run is kept verbatim so sprint 03 source quotes are unchanged.
 */
export function reconstructLines(pages: TextItem[][]): TextLine[] {
  const lines: TextLine[] = [];
  pages.forEach((items, p) => {
    const rows: TextItem[][] = [];
    for (const item of items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
      const row = rows.find((r) => Math.abs(r[0].y - item.y) <= 2);
      if (row) row.push(item);
      else rows.push([item]);
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      const cells = row.flatMap((i) => i.str.split('|')).map((c) => c.trim());
      const x = Math.min(...row.map((i) => i.x)),
        y = Math.min(...row.map((i) => i.y));
      lines.push({
        page: p + 1,
        text: row.length === 1 ? row[0].str : cells.filter(Boolean).join(' | '),
        cells: cells.filter(Boolean),
        runs: row.length,
        bounds:
          row.length === 1
            ? { x, y, width: row[0].width, height: row[0].height }
            : {
                x,
                y,
                width: Math.max(...row.map((i) => i.x + i.width)) - x,
                height: Math.max(...row.map((i) => i.y + i.height)) - y,
              },
      });
    }
  });
  return lines;
}
export interface CollectionDate {
  /** ISO day anchored at midnight UTC; null when absent, invalid or ambiguous. */
  measuredAt: string | null;
  issue:
    'MEASUREMENT_DATE_MISSING' | 'MEASUREMENT_DATE_INVALID' | 'MEASUREMENT_DATE_AMBIGUOUS' | null;
  /** Distinct valid days found, for display; never used to pick one. */
  found: string[];
}
/** Every "PRELEVEMENT : dd/mm/yyyy" occurrence must agree and be a real calendar day. */
export function collectionDate(text: string): CollectionDate {
  const found = new Set<string>();
  let invalid = false;
  for (const m of text.matchAll(/PRELEVEMENT\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/g)) {
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso) found.add(iso);
    else invalid = true;
  }
  const days = [...found].sort();
  if (invalid) return { measuredAt: null, issue: 'MEASUREMENT_DATE_INVALID', found: days };
  if (days.length > 1)
    return { measuredAt: null, issue: 'MEASUREMENT_DATE_AMBIGUOUS', found: days };
  if (!days.length) return { measuredAt: null, issue: 'MEASUREMENT_DATE_MISSING', found: days };
  return { measuredAt: `${days[0]}T00:00:00Z`, issue: null, found: days };
}
const frenchDay = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
export async function extractSyntheticPdf(
  bytes: Uint8Array,
  personId: string,
): Promise<PdfProposal> {
  if (personId !== PERSON_ALPHA) throw Error('FORBIDDEN');
  const fixtureId = await identifyFixture(bytes);
  const sha256 = await pdfDigest(bytes);
  const id = 'pdf-' + sha256;
  const pdf = await getDocumentProxy(Uint8Array.from(bytes), {
    useSystemFonts: false,
    disableFontFace: true,
    maxImageSize: 1_000_000,
    verbosity: 0,
  });
  try {
    if (pdf.numPages > 8) throw Error('INVALID_PDF_PAGE_LIMIT');
    const { items } = await extractTextItems(pdf);
    const text = items
      .flat()
      .map((i) => i.str)
      .join('\n');
    // Every dossier mention must match the open record, not only the first one.
    const patients = [...text.matchAll(/DOSSIER SYNTHETIQUE\s*:\s*(demo-[a-z]+)/gi)].map(
      (m) => m[1],
    );
    if (patients.some((p) => p !== personId)) throw Error('FORBIDDEN');
    const patient = patients[0];
    const date = collectionDate(text);
    const measured = date.measuredAt;
    const laboratory =
      /LABORATOIRE\s*:\s*([^\n]+)/.exec(text)?.[1]?.trim() || 'Laboratoire non identifié';
    const candidates: PdfCandidate[] = [];
    const unrecognized: UnrecognizedLine[] = [];
    for (const line of reconstructLines(items)) {
      if (line.cells.length < 2 || normal(line.cells[0]) === 'parametre') continue;
      const code = line.cells.length <= 4 ? alias[normal(line.cells[0])] : undefined;
      if (!code || line.cells.length < 3) {
        unrecognized.push({ page: line.page, text: line.text });
        continue;
      }
      const definition = biomarkers.find((b) => b.code === code)!;
      const [, rawValue, rawUnit, rawReference] = line.cells;
      const unit = rawUnit.trim();
      const canonicalUnit = unit.replaceAll('μ', 'µ');
      const issues: CandidateIssue[] = [];
      const notes: CandidateNote[] = [];
      let value: number | null = null;
      if (NUMBER.test(rawValue)) value = num(rawValue);
      else
        issues.push(
          /^[<>≤≥]/.test(rawValue) ? 'VALUE_QUALIFIER_NOT_SUPPORTED' : 'VALUE_NOT_NUMERIC',
        );
      if (canonicalUnit !== definition.unit) issues.push('UNIT_MISMATCH_NO_CONVERSION');
      if (date.issue) issues.push(date.issue);
      if (!patient) issues.push('PATIENT_NOT_IDENTIFIED');
      if (value !== null && (!Number.isFinite(value) || value < 0)) issues.push('INVALID_VALUE');
      const range = rawReference ? RANGE.exec(rawReference) : null;
      if (!rawReference) notes.push('REFERENCE_ABSENT');
      else if (!range) notes.push('REFERENCE_NOT_STRUCTURED');
      if (line.runs > 1) notes.push('ROW_RECONSTRUCTED_FROM_COLUMNS');
      const candidateId = `${code}-p${line.page}-r${candidates.length + 1}`;
      const observation =
        value === null
          ? null
          : ({
              id: `${id}-${candidateId}`,
              personId: PERSON_ALPHA,
              synthetic: true,
              code,
              value,
              unit: canonicalUnit,
              measuredAt: measured || DEMO_NOW,
              measuredPrecision: 'day',
              knownAt: DEMO_NOW,
              method: 'lab_method_not_reported',
              sourceId: id,
              quality: 'needs-review',
              ...(range
                ? {
                    reference: {
                      low: num(range[1]),
                      high: num(range[2]),
                      unit: canonicalUnit,
                      laboratory,
                    },
                  }
                : {}),
              evidence: {
                documentId: id,
                page: line.page,
                sourceText: line.text,
                method: 'native-pdf',
                validation: 'needs-review',
                processedAt: new Date().toISOString(),
                confidence: null,
                originalValue: value,
                originalUnit: unit,
              },
            } satisfies Observation);
      candidates.push({
        id: candidateId,
        code,
        label: definition.shortLabel,
        value,
        unit,
        originalText: line.text,
        page: line.page,
        bounds: line.bounds,
        eligible: false,
        issues,
        ...(notes.length ? { notes } : {}),
        observation,
      });
    }
    // The same parameter read twice in one document is ambiguous: block every occurrence.
    for (const c of candidates)
      if (candidates.filter((o) => o.code === c.code).length > 1)
        c.issues.push('DUPLICATE_IN_DOCUMENT');
    for (const c of candidates) {
      c.eligible = c.issues.length === 0 && c.observation !== null;
      c.observation = c.eligible ? ObservationSchema.parse(c.observation) : null;
    }
    const warnings: string[] = [];
    if (!candidates.length)
      warnings.push('Aucun résultat structuré trouvé. Aucun OCR n’a été exécuté.');
    if (date.issue === 'MEASUREMENT_DATE_AMBIGUOUS')
      warnings.push(
        `Plusieurs dates de prélèvement (${date.found.map(frenchDay).join(', ')}) : aucune n’est choisie automatiquement.`,
      );
    if (date.issue === 'MEASUREMENT_DATE_INVALID')
      warnings.push('Date de prélèvement invalide : aucun résultat ne peut être daté.');
    return {
      id,
      fixtureId,
      sha256,
      method: 'pdf-native-v1',
      datePrecision: 'day',
      pages: pdf.numPages,
      status: items.every((page) => page.every((item) => !item.str.trim()))
        ? 'ocr-required'
        : 'needs-review',
      document: {
        id,
        personId,
        synthetic: true,
        title: measured ? `Bilan PDF · ${frenchDay(measured)}` : 'Bilan PDF · date à vérifier',
        date: measured || DEMO_NOW,
        datePrecision: 'day',
        knownAt: DEMO_NOW,
        laboratory,
        pages: pdf.numPages,
        kind: 'biology',
        status: 'needs-review',
      },
      candidates,
      unrecognized,
      warnings,
    };
  } finally {
    await pdf.loadingTask.destroy();
  }
}
export function selectedObservations(proposal: PdfProposal, ids: string[]): Observation[] {
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 30 ||
    new Set(ids).size !== ids.length
  )
    throw Error('INVALID_SELECTION');
  return ids.map((id) => {
    const c = proposal.candidates.find((c) => c.id === id);
    if (!c?.eligible || !c.observation) throw Error('INVALID_SELECTION');
    return ObservationSchema.parse(c.observation);
  });
}
export const PdfSelectionSchema = z.strictObject({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  selectedIds: z.array(z.string().max(100)).min(1).max(30),
});
