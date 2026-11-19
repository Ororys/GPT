import type { Biomarker } from '../health-records/model';
import { labBiomarkers } from '../health-records/fixtures';
import type { AiReading, AiResult } from './contract';
/**
 * Turns what the AI transcribed into candidates the person reviews. The AI's text is never
 * trusted as a number: same strict rules as the native PDF reader (sprints 04 and 19).
 * - plain decimal or French thousands in groups of three; « < 0,5 » and the like blocked;
 * - unit kept as printed, only μ/µ harmonised; a catalog parameter in another unit is
 *   blocked (no conversion);
 * - reference range only when printed as « a - b », in the result's unit;
 * - the date is the document's date entered by the person (day precision).
 */
const NUMBER = /^-?(?:\d+|\d{1,3}(?:[   ]\d{3})+)(?:[.,]\d+)?$/;
const RANGE = /^(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)$/;
const num = (s: string) => Number(s.replace(/[   ]/g, '').replace(',', '.'));
const micro = (u: string) => u.replaceAll('μ', 'µ');
const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
/** Same printed label and unit → same series across documents. */
export function seriesCode(label: string, unit: string) {
  const slug = normal(`${label} ${unit}`).replaceAll(' ', '_').slice(0, 60);
  return `USR_${slug.toUpperCase()}`;
}
export type BlockReason = 'not-a-number' | 'no-unit' | 'unit-mismatch' | 'duplicate';
export interface AiCandidate {
  id: string;
  label: string;
  printedValue: string;
  value: number | null;
  unit: string;
  originalUnit: string;
  page: number;
  category: string;
  code: string;
  /** Present when the parameter is not in the catalog: a new series for this record. */
  newBiomarker?: Biomarker;
  reference?: { low: number; high: number; laboratory: string; unit: string };
  referenceText: string | null;
  blocked: BlockReason | null;
}
const PALETTE = ['#9bb7ee', '#b9a6e1', '#a6e1c6', '#d8c3a5', '#9fd3d9', '#c9b3d9'];
export function aiCandidates(reading: AiReading, known: Biomarker[], laboratory: string) {
  const catalog = new Map(labBiomarkers.map((b) => [b.code, b]));
  const seen = new Map<string, number>();
  const list: AiCandidate[] = reading.results.map((r: AiResult, i) => {
    const originalUnit = (r.unit ?? '').trim();
    const unit = micro(originalUnit);
    const printed = r.value.trim();
    const value = NUMBER.test(printed) ? num(printed) : null;
    const fromCatalog = r.catalogCode !== 'NONE' ? catalog.get(r.catalogCode) : undefined;
    let code: string;
    let newBiomarker: Biomarker | undefined;
    let blocked: BlockReason | null = value === null ? 'not-a-number' : !unit ? 'no-unit' : null;
    if (fromCatalog) {
      code = fromCatalog.code;
      if (!blocked && micro(fromCatalog.unit) !== unit) blocked = 'unit-mismatch';
    } else {
      code = seriesCode(r.label, unit);
      if (!known.some((b) => b.code === code))
        newBiomarker = {
          code,
          label: r.label,
          shortLabel: r.label.slice(0, 40),
          category: r.category,
          unit,
          color: PALETTE[[...code].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]!,
          decimals:
            printed.includes(',') || printed.includes('.')
              ? (printed.split(/[.,]/)[1]?.length ?? 0)
              : 0,
        };
    }
    // Two lines for the same parameter in one document: never choose between them.
    seen.set(code, (seen.get(code) ?? 0) + 1);
    const range = r.referenceText?.trim().match(RANGE);
    return {
      id: `ai-${i}`,
      label: r.label,
      printedValue: printed,
      value,
      unit,
      originalUnit,
      page: r.page,
      category: fromCatalog?.category ?? r.category,
      code,
      ...(newBiomarker ? { newBiomarker } : {}),
      ...(range && value !== null && unit
        ? { reference: { low: num(range[1]!), high: num(range[2]!), laboratory, unit } }
        : {}),
      referenceText: r.referenceText,
      blocked,
    };
  });
  for (const c of list) if ((seen.get(c.code) ?? 0) > 1) c.blocked = 'duplicate';
  return list;
}
export const BLOCK_LABEL: Record<BlockReason, string> = {
  'not-a-number': 'Valeur non numérique telle qu’imprimée (« < », texte…) : non reprise',
  'no-unit': 'Unité absente : non reprise',
  'unit-mismatch': 'Unité différente de la série existante : aucune conversion, non reprise',
  duplicate: 'Paramètre présent plusieurs fois dans le document : aucun choix automatique',
};
