import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ConsultationSummary } from './model';
/** Helvetica (WinAnsi) cannot encode a few typographic characters: replace them only. */
const latin = (s: string) =>
  s
    .replaceAll('·', '-')
    .replaceAll('’', "'")
    .replaceAll('œ', 'oe')
    .replaceAll('–', '-')
    .replaceAll('—', '-')
    .replaceAll('μ', 'µ')
    .replaceAll('≥', '>=')
    .replaceAll('≤', '<=')
    .replaceAll(' ', ' ')
    .replaceAll(' ', ' ');
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
const n = (v: number, digits = 2) => v.toLocaleString('fr-FR', { maximumFractionDigits: digits });
const ink = rgb(0.12, 0.2, 0.24),
  muted = rgb(0.38, 0.45, 0.47),
  rule = rgb(0.84, 0.88, 0.87);
export async function consultationSummaryPdf(
  s: ConsultationSummary,
  profile: { name: string; personId: string },
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Resume factuel pour consultation');
  pdf.setAuthor('Convergence - prototype synthetique');
  pdf.setCreationDate(new Date(s.asOf));
  pdf.setModificationDate(new Date(s.asOf));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const left = 48,
    width = 499,
    bottom = 70;
  let page: PDFPage = pdf.addPage([595, 842]);
  let y = 790;
  const footer = (p: PDFPage, index: number) =>
    p.drawText(
      latin(`Données synthétiques · aucun diagnostic, score ni recommandation · page ${index}`),
      { x: left, y: 40, size: 8, font, color: muted },
    );
  const ensure = (h: number) => {
    if (y - h < bottom) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
  };
  const wrap = (text: string, f: PDFFont, size: number, max: number) => {
    const words = latin(text).split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (f.widthOfTextAtSize(next, size) > max && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const para = (
    text: string,
    o: { size?: number; strong?: boolean; color?: typeof ink; indent?: number; gap?: number } = {},
  ) => {
    const size = o.size ?? 10,
      f = o.strong ? bold : font,
      indent = o.indent ?? 0;
    for (const l of wrap(text, f, size, width - indent)) {
      ensure(size + 4);
      page.drawText(l, { x: left + indent, y, size, font: f, color: o.color ?? ink });
      y -= size + 4;
    }
    y -= o.gap ?? 2;
  };
  const heading = (text: string) => {
    ensure(40);
    y -= 10;
    para(text, { size: 13, strong: true, gap: 0 });
    page.drawLine({
      start: { x: left, y: y + 2 },
      end: { x: left + width, y: y + 2 },
      thickness: 0.6,
      color: rule,
    });
    y -= 8;
  };

  para('CONVERGENCE · RÉSUMÉ FACTUEL POUR CONSULTATION', {
    size: 9,
    strong: true,
    color: muted,
    gap: 12,
  });
  para('Ce que contient votre dossier, avec ses sources', { size: 18, strong: true, gap: 6 });
  para(`Profil fictif : ${profile.name} · dossier ${profile.personId}`);
  para(
    `Période : du ${day(s.from)} au ${day(s.asOf)} (${s.periodDays} jours) · état du dossier au ${day(s.asOf)}`,
  );
  para(
    'Document descriptif préparé pour échanger avec un professionnel. Il liste les données présentes, leur source et leurs limites. Il ne contient ni interprétation, ni diagnostic, ni score, ni recommandation. Les références sont celles de chaque laboratoire, pas des normes universelles.',
    { color: muted, gap: 6 },
  );

  heading('Biologie : valeurs présentes, dans l’ordre chronologique');
  if (!s.markers.length) para('Aucun résultat biologique sur la période.', { color: muted });
  for (const m of s.markers) {
    ensure(40);
    para(`${m.label} · ${m.values.length} résultat(s)`, { strong: true, size: 11, gap: 1 });
    if (m.mixedUnits)
      para(
        'Plusieurs unités sur la période : valeurs listées telles quelles, sans conversion ni comparaison.',
        {
          indent: 12,
          color: muted,
          size: 9,
        },
      );
    for (const v of m.values) {
      const parts = [
        `${day(v.date)} : ${n(v.value, 6)} ${v.unit}`,
        v.reference
          ? `référence ${v.reference.laboratory} ${n(v.reference.low, 6)}–${n(v.reference.high, 6)} ${v.unit}`
          : 'référence non structurée',
        `source : ${v.documentTitle}, page ${v.page}`,
      ];
      if (v.correction)
        parts.push(
          `corrigée (version ${v.correction.version}), valeur lue ${n(v.correction.originalValue, 6)}`,
        );
      if (v.needsReview) parts.push('à vérifier');
      para(parts.join(' · '), { indent: 12, size: 9, gap: 1 });
    }
    y -= 4;
  }
  if (s.missing.length) {
    ensure(30);
    para('Aucune mesure sur la période pour : ' + s.missing.join(', ') + '.', { color: muted });
  }

  heading('Quotidien : données de la montre');
  const sl = s.sleep;
  para(
    `Nuits enregistrées : ${sl.nights} sur ${sl.days} jours (${n((sl.nights / sl.days) * 100, 0)} % de couverture). Les jours sans mesure ne sont pas complétés.`,
  );
  if (sl.nights) {
    para(
      `Moyennes des seules nuits disponibles : durée ${n(sl.meanHours!, 1)} h · FC au repos ${n(sl.meanRestingHeartRate!, 1)} bpm · VFC ${n(sl.meanHrv!, 1)} ms (${sl.hrvMethods.join(', ')}).`,
    );
    para(
      `Appareil(s) : ${sl.devices.join(', ')}. Estimations du fabricant ; une VFC ${sl.hrvMethods.join('/')} n’est pas comparable à une VFC calculée autrement.`,
      { color: muted, size: 9 },
    );
  }
  const a = s.activities;
  para(
    `Activités : ${a.count} · ${n(a.distanceKm, 1)} km · ${Math.floor(a.durationMinutes / 60)} h ${String(a.durationMinutes % 60).padStart(2, '0')}${a.devices.length ? ' · ' + a.devices.join(', ') : ''}.`,
  );

  heading('Événements notés dans le dossier');
  if (!s.events.length) para('Aucun événement sur la période.', { color: muted });
  for (const e of s.events)
    para(`${day(e.date)} : ${e.title}${e.kind === 'declared' ? ' (déclaré)' : ''}`, {
      size: 9,
      gap: 1,
    });

  heading('Qualité et limites');
  para(
    `${s.quality.documents} document(s) source sur la période · ${s.quality.needsReview} résultat(s) « à vérifier » · ${s.quality.corrected} résultat(s) corrigé(s) avec historique conservé.`,
  );
  para(
    'Dates des bilans connues au jour près (aucune heure de prélèvement supposée). Méthodes analytiques non fournies par les documents. Aucune conversion d’unité. Mettre des données en parallèle n’établit pas de lien de cause à effet. Données entièrement fictives, prototype sans usage médical.',
    { color: muted, size: 9 },
  );
  pdf.getPages().forEach((p, i) => footer(p, i + 1));
  return pdf.save();
}
