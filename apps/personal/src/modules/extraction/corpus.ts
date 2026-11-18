import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export type FixtureId =
  'standard' | 'decimales' | 'unites' | 'scan' | 'colonnes' | 'ambigus' | 'dates' | 'autre-profil';
export const PDF_FIXTURES = [
  {
    id: 'standard' as const,
    label: 'Bilan biologique français',
    description: '6 paramètres, texte natif et références de laboratoire.',
  },
  {
    id: 'decimales' as const,
    label: 'Virgules et plusieurs pages',
    description: 'Décimales françaises, trois résultats sur deux pages.',
  },
  {
    id: 'unites' as const,
    label: 'Unité à vérifier',
    description: 'Un résultat dans une unité non convertie automatiquement.',
  },
  {
    id: 'scan' as const,
    label: 'Document sans texte',
    description: 'Cas limite : aucune extraction sans OCR.',
  },
  {
    id: 'colonnes' as const,
    label: 'Tableau en colonnes',
    description: 'Cellules séparées, référence unilatérale et paramètre non pris en charge.',
  },
  {
    id: 'ambigus' as const,
    label: 'Résultats ambigus',
    description: 'Paramètre répété, valeur précédée de « < » et ligne non reconnue.',
  },
  {
    id: 'dates' as const,
    label: 'Deux dates de prélèvement',
    description: 'Dates contradictoires : aucun résultat ajoutable.',
  },
];
const values: Record<Exclude<FixtureId, 'scan' | ExtendedId>, string[]> = {
  standard: [
    'Ferritine | 64 | µg/L | 30 - 300',
    'LDL-cholesterol | 1,27 | g/L | 0,5 - 1,6',
    'HbA1c | 5,4 | % | 4 - 6',
    'Creatinine | 9,2 | mg/L | 7 - 13',
    'Vitamine D | 35 | ng/mL | 20 - 60',
    'Hemoglobine | 14,6 | g/dL | 13 - 17',
  ],
  decimales: [
    'LDL-cholesterol | 1,26 | g/L | 0,5 - 1,6',
    'Creatinine | 9,1 | mg/L | 7 - 13',
    'HbA1c | 5,3 | % | 4 - 6',
  ],
  unites: ['LDL-cholesterol | 3,2 | mmol/L | 0 - 4', 'Ferritine | 61 | µg/L | 30 - 300'],
  'autre-profil': ['Ferritine | 51 | µg/L | 30 - 300'],
};
const pending = new Map<string, Promise<Uint8Array>>();
export function fixturePdf(id: FixtureId): Promise<Uint8Array> {
  if (![...PDF_FIXTURES.map((f) => f.id), 'autre-profil'].includes(id)) throw Error('NOT_FOUND');
  let result = pending.get(id);
  if (!result) {
    result = generate(id);
    pending.set(id, result);
  }
  return result.then((b) => b.slice());
}
async function generate(id: FixtureId) {
  if (isExtended(id)) return generateExtended(id);
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date('2026-11-18T00:00:00Z'));
  pdf.setModificationDate(new Date('2026-11-18T00:00:00Z'));
  pdf.setAuthor('Convergence - corpus synthetique');
  pdf.setTitle('Bilan biologique synthetique ' + id);
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = id === 'decimales' ? 2 : 1;
  for (let n = 0; n < pages; n++) {
    const page = pdf.addPage([595, 842]);
    if (id === 'scan') {
      page.drawRectangle({ x: 50, y: 100, width: 495, height: 640, color: rgb(0.94, 0.94, 0.94) });
      continue;
    }
    const line = (text: string, y: number, size = 11, strong = false) =>
      page.drawText(text, { x: 44, y, size, font: strong ? bold : font });
    line('BILAN BIOLOGIQUE - DONNEES SYNTHETIQUES', 790, 15, true);
    line('DOSSIER SYNTHETIQUE : ' + (id === 'autre-profil' ? 'demo-beta' : 'demo-alpha'), 757);
    line('PRELEVEMENT : 17/11/2026', 733);
    line('LABORATOIRE : Laboratoire Atlas - fictif', 709);
    line('Parametre | Resultat | Unite | Reference du laboratoire', 665, 10, true);
    const rows = values[id].filter((_, i) => id !== 'decimales' || (n === 0 ? i < 2 : i >= 2));
    rows.forEach((text, i) => line(text, 630 - i * 46));
    line('Aucun patient reel. Aucune interpretation medicale.', 100, 10);
    line(`Page ${n + 1}/${pages} - fichier de demonstration ${id}`, 76, 9);
  }
  return pdf.save();
}
/**
 * Sprint 04 corpus. Kept separate from `generate` so the bytes, and therefore the
 * whitelisted SHA-256, of the five sprint 03 fixtures never change.
 */
type ExtendedId = 'colonnes' | 'ambigus' | 'dates';
const isExtended = (id: FixtureId): id is ExtendedId =>
  id === 'colonnes' || id === 'ambigus' || id === 'dates';
interface ExtendedPage {
  date: string;
  /** Pipe rows are drawn as one text run; cell rows as one run per column. */
  rows: (string | string[])[];
}
const extended: Record<ExtendedId, ExtendedPage[]> = {
  colonnes: [
    {
      date: '03/10/2026',
      rows: [
        ['Ferritine', '58', 'µg/L', '30 - 300'],
        ['Vitamine D', '28', 'ng/mL', '> 20'],
        ['Glycemie a jeun', '0,92', 'g/L', '0,70 - 1,10'],
        ['Hemoglobine', '14,1', 'g/dL', '13 - 17'],
      ],
    },
  ],
  ambigus: [
    {
      date: '24/10/2026',
      rows: [
        'Ferritine | 64 | µg/L | 30 - 300',
        'Creatinine | 9,0 | mg/L | 7 - 13',
        'HbA1c | < 4 | % | 4 - 6',
        'Ferritine | 46 | µg/L | 30 - 300',
        'Commentaire | voir le laboratoire',
      ],
    },
  ],
  dates: [
    { date: '14/09/2026', rows: ['LDL-cholesterol | 1,31 | g/L | 0,5 - 1,6'] },
    { date: '21/09/2026', rows: ['HbA1c | 5,5 | % | 4 - 6'] },
  ],
};
const columns = [44, 230, 330, 420];
async function generateExtended(id: ExtendedId) {
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date('2026-11-18T00:00:00Z'));
  pdf.setModificationDate(new Date('2026-11-18T00:00:00Z'));
  pdf.setAuthor('Convergence - corpus synthetique');
  pdf.setTitle('Bilan biologique synthetique ' + id);
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = extended[id];
  pages.forEach((spec, n) => {
    const page = pdf.addPage([595, 842]);
    const text = (t: string, x: number, y: number, size = 11, strong = false) =>
      page.drawText(t, { x, y, size, font: strong ? bold : font });
    text('BILAN BIOLOGIQUE - DONNEES SYNTHETIQUES', 44, 790, 15, true);
    text('DOSSIER SYNTHETIQUE : demo-alpha', 44, 757);
    text('PRELEVEMENT : ' + spec.date, 44, 733);
    text('LABORATOIRE : Laboratoire Boreal - fictif', 44, 709);
    const header = ['Parametre', 'Resultat', 'Unite', 'Reference du laboratoire'];
    if (spec.rows.some(Array.isArray)) header.forEach((h, i) => text(h, columns[i], 665, 10, true));
    else text(header.join(' | '), 44, 665, 10, true);
    spec.rows.forEach((row, i) => {
      const y = 630 - i * 46;
      if (Array.isArray(row)) row.forEach((cell, c) => text(cell, columns[c], y));
      else text(row, 44, y);
    });
    text('Aucun patient reel. Aucune interpretation medicale.', 44, 100, 10);
    text(`Page ${n + 1}/${pages.length} - fichier de demonstration ${id}`, 44, 76, 9);
  });
  return pdf.save();
}
export async function pdfDigest(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function identifyFixture(bytes: Uint8Array): Promise<FixtureId> {
  if (bytes.length > 500_000) throw Error('PAYLOAD_TOO_LARGE');
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw Error('INVALID_PDF');
  const sha = await pdfDigest(bytes);
  for (const id of [...PDF_FIXTURES.map((f) => f.id), 'autre-profil'] as FixtureId[])
    if ((await pdfDigest(await fixturePdf(id))) === sha) return id;
  throw Error('INVALID_DEMO_PDF');
}
