import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { HealthRecord, HealthDocument } from '../health-records/model';
const latin = (s: string) =>
  s
    .replaceAll('·', '-')
    .replaceAll('’', "'")
    .replaceAll('œ', 'oe')
    .replaceAll('–', '-')
    .replaceAll('—', '-');
export async function documentPdf(record: HealthRecord, document: HealthDocument) {
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date('2026-11-18T00:00:00Z'));
  pdf.setModificationDate(new Date('2026-11-18T00:00:00Z'));
  pdf.setTitle(latin(document.title));
  pdf.setAuthor('Health Convergence - synthetic fixture');
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const text = (s: string, y: number, size = 11, strong = false) =>
    page.drawText(latin(s), {
      x: 48,
      y,
      size,
      font: strong ? bold : font,
      color: rgb(0.12, 0.2, 0.24),
    });
  page.drawRectangle({ x: 0, y: 730, width: 595, height: 112, color: rgb(0.9, 0.96, 0.94) });
  text('CONVERGENCE / DOCUMENT SYNTHETIQUE', 793, 16, true);
  text('Aucun patient reel. Aucun usage medical.', 768);
  text(document.title, 690, 17, true);
  text(document.laboratory, 663);
  text('Profil fictif : Alex Martin - dossier demo-alpha', 635);
  text(
    'Mesure : ' + document.date.slice(0, 10) + ' / connu le : ' + document.knownAt.slice(0, 10),
    614,
  );
  text('Parametre', 566, 11, true);
  page.drawText('Resultat / unite / reference du laboratoire fictif', {
    x: 230,
    y: 566,
    size: 10,
    font: bold,
  });
  const rows = record.observations.filter((o) => o.sourceId === document.id);
  rows.forEach((o, i) => {
    const y = 534 - i * 48;
    const definition = record.biomarkers.find((b) => b.code === o.code);
    text(definition?.label || o.code, y);
    page.drawText(
      latin(
        `${o.value} ${o.unit}${o.reference ? '  [' + o.reference.low + ' - ' + o.reference.high + ']' : ''}`,
      ),
      { x: 230, y, size: 11, font },
    );
    page.drawLine({
      start: { x: 48, y: y - 15 },
      end: { x: 547, y: y - 15 },
      thickness: 0.5,
      color: rgb(0.84, 0.88, 0.87),
    });
  });
  if (!rows.length) {
    text('Compte rendu de demonstration : document a verifier.', 530);
    text('Aucune extraction de faits medicaux dans ce sprint.', 505);
  }
  text('Ce PDF est genere depuis les fixtures du prototype.', 140, 10);
  text("Il ne resulte pas d'une extraction OCR ou IA.", 123, 10);
  text('Les references sont fictives et ne constituent pas des normes universelles.', 106, 9);
  text('Source : ' + document.id + ' / page 1', 65, 9);
  return pdf.save();
}
