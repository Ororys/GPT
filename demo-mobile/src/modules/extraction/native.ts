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
export interface PdfCandidate {
  id: string;
  code: string;
  label: string;
  value: number;
  unit: string;
  originalText: string;
  page: number;
  bounds: { x: number; y: number; width: number; height: number };
  eligible: boolean;
  issues: string[];
  observation: Observation | null;
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
const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
    const patient = /DOSSIER SYNTHETIQUE\s*:\s*(demo-[a-z]+)/i.exec(text)?.[1];
    if (patient && patient !== personId) throw Error('FORBIDDEN');
    const date = /PRELEVEMENT\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
    const measured = date ? `${date[3]}-${date[2]}-${date[1]}T00:00:00Z` : null;
    const validDate =
      measured &&
      Number.isFinite(Date.parse(measured)) &&
      new Date(measured).toISOString().slice(0, 10) === measured.slice(0, 10);
    const laboratory =
      /LABORATOIRE\s*:\s*([^\n]+)/.exec(text)?.[1]?.trim() || 'Laboratoire non identifié';
    const candidates: PdfCandidate[] = [];
    for (let p = 0; p < items.length; p++)
      for (const item of items[p]) {
        const match =
          /^([^|]+)\|\s*(-?\d+(?:[.,]\d+)?)\s*\|\s*([^|]+)\|\s*(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(
            item.str,
          );
        if (!match) continue;
        const code = alias[normal(match[1])];
        if (!code) continue;
        const definition = biomarkers.find((b) => b.code === code)!;
        const value = Number(match[2].replace(',', '.')),
          unit = match[3].trim();
        const issues: string[] = [];
        const canonicalUnit = unit.replaceAll('μ', 'µ');
        if (canonicalUnit !== definition.unit) issues.push('UNIT_MISMATCH_NO_CONVERSION');
        if (!validDate) issues.push('MEASUREMENT_DATE_MISSING');
        if (!patient) issues.push('PATIENT_NOT_IDENTIFIED');
        if (!Number.isFinite(value) || value < 0) issues.push('INVALID_VALUE');
        const candidateId = `${code}-p${p + 1}-r${candidates.length + 1}`;
        const observation: Observation = {
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
          reference: {
            low: Number(match[4].replace(',', '.')),
            high: Number(match[5].replace(',', '.')),
            unit: canonicalUnit,
            laboratory,
          },
          evidence: {
            documentId: id,
            page: p + 1,
            sourceText: item.str,
            method: 'native-pdf',
            validation: 'needs-review',
            processedAt: new Date().toISOString(),
            confidence: null,
            originalValue: value,
            originalUnit: unit,
          },
        };
        const candidate: PdfCandidate = {
          id: candidateId,
          code,
          label: definition.shortLabel,
          value,
          unit,
          originalText: item.str,
          page: p + 1,
          bounds: { x: item.x, y: item.y, width: item.width, height: item.height },
          eligible: issues.length === 0,
          issues,
          observation: issues.length ? null : ObservationSchema.parse(observation),
        };
        candidates.push(candidate);
      }
    const warnings = candidates.length
      ? []
      : ['Aucun résultat structuré trouvé. Aucun OCR n’a été exécuté.'];
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
        title: 'Bilan PDF · 17 novembre 2026',
        date: measured || DEMO_NOW,
        datePrecision: 'day',
        knownAt: DEMO_NOW,
        laboratory,
        pages: pdf.numPages,
        kind: 'biology',
        status: 'needs-review',
      },
      candidates,
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
