import {
  type HealthRecord,
  type HealthDocument,
  type Biomarker,
  type Observation,
  PERSON_ALPHA,
  PERSON_BETA,
  DEMO_NOW,
} from './model';
export const labBiomarkers: Biomarker[] = [
  {
    code: 'FERRITIN',
    label: 'Ferritine',
    shortLabel: 'Ferritine',
    category: 'Statut martial',
    unit: 'µg/L',
    color: '#c5abff',
    decimals: 0,
  },
  {
    code: 'LDL_C',
    label: 'LDL-cholestérol',
    shortLabel: 'LDL-cholestérol',
    category: 'Lipides',
    unit: 'g/L',
    color: '#69c9d4',
    decimals: 2,
  },
  {
    code: 'HBA1C',
    label: 'Hémoglobine glyquée',
    shortLabel: 'HbA1c',
    category: 'Métabolisme glucidique',
    unit: '%',
    color: '#efbd7e',
    decimals: 1,
  },
  {
    code: 'CREATININE',
    label: 'Créatinine',
    shortLabel: 'Créatinine',
    category: 'Fonction rénale',
    unit: 'mg/L',
    color: '#85aafa',
    decimals: 1,
  },
  {
    code: 'VITD',
    label: 'Vitamine D',
    shortLabel: 'Vitamine D',
    category: 'Vitamines',
    unit: 'ng/mL',
    color: '#e7d295',
    decimals: 0,
  },
  {
    code: 'HEMOGLOBIN',
    label: 'Hémoglobine',
    shortLabel: 'Hémoglobine',
    category: 'Hématologie',
    unit: 'g/dL',
    color: '#e7a9b0',
    decimals: 1,
  },
];
/**
 * Centre measurements (R01, R03, R05): same catalogue and observation model as biology,
 * attached to the annual centre reports. No laboratory reference range: none exists for
 * these measures in this prototype. The protocol is stated on every value.
 */
export const CENTRE_CATEGORY = 'Mesures du centre';
export const centreMeasures: Biomarker[] = [
  {
    code: 'WAIST',
    label: 'Tour de taille',
    shortLabel: 'Tour de taille',
    category: CENTRE_CATEGORY,
    unit: 'cm',
    color: '#9fd8b9',
    decimals: 0,
  },
  {
    code: 'BP_SYS',
    label: 'Pression artérielle systolique',
    shortLabel: 'PA systolique',
    category: CENTRE_CATEGORY,
    unit: 'mmHg',
    color: '#f0a58f',
    decimals: 0,
  },
  {
    code: 'BP_DIA',
    label: 'Pression artérielle diastolique',
    shortLabel: 'PA diastolique',
    category: CENTRE_CATEGORY,
    unit: 'mmHg',
    color: '#d9b3e8',
    decimals: 0,
  },
  {
    code: 'GRIP',
    label: 'Force de préhension',
    shortLabel: 'Préhension',
    category: CENTRE_CATEGORY,
    unit: 'kg',
    color: '#b5c8f2',
    decimals: 1,
  },
];
/** Full catalogue shown in the record: laboratory parameters, then centre measurements. */
export const biomarkers: Biomarker[] = [...labBiomarkers, ...centreMeasures];
export const CENTRE_PROTOCOL: Record<string, string> = {
  WAIST:
    'Mètre ruban, debout, à mi-distance entre dernière côte et crête iliaque, en fin d’expiration (protocole fictif)',
  BP_SYS:
    'Tensiomètre automatique, assis après 5 min de repos, moyenne de 3 mesures au bras gauche (protocole fictif)',
  BP_DIA:
    'Tensiomètre automatique, assis après 5 min de repos, moyenne de 3 mesures au bras gauche (protocole fictif)',
  GRIP: 'Dynamomètre à main, main dominante, meilleur de 3 essais (protocole fictif)',
};
const centreVisits = [
  { id: 'report-2025-10-22', date: '2025-10-22T09:00:00Z', knownAt: '2025-10-30T11:00:00Z' },
  { id: 'report-2026-10-28', date: '2026-10-28T09:00:00Z', knownAt: '2026-11-05T11:00:00Z' },
];
const centreValues: Record<string, number[]> = {
  WAIST: [86, 84],
  BP_SYS: [124, 121],
  BP_DIA: [78, 77],
  GRIP: [41.5, 42],
};
const dates = ['2024-02-09', '2024-08-16', '2025-02-12', '2025-11-14', '2026-05-12', '2026-11-04'];
const values: Record<string, number[]> = {
  FERRITIN: [43, 48, 46, 54, 57, 62],
  LDL_C: [1.42, 1.38, 1.4, 1.34, 1.31, 1.28],
  HBA1C: [5.5, 5.4, 5.5, 5.4, 5.3, 5.3],
  CREATININE: [9.6, 9.4, 9.5, 9.2, 9.3, 9.1],
  VITD: [24, 31, 27, 29, 34, 36],
  HEMOGLOBIN: [14.3, 14.5, 14.4, 14.6, 14.5, 14.7],
};
const references: Record<string, [number, number]> = {
  FERRITIN: [30, 300],
  LDL_C: [0.5, 1.6],
  HBA1C: [4, 6],
  CREATININE: [7, 13],
  VITD: [20, 60],
  HEMOGLOBIN: [13, 17],
};
export const demoDocuments: HealthDocument[] = dates.map((d, i) => ({
  id: `lab-${d}`,
  personId: PERSON_ALPHA,
  title: `Bilan biologique · ${new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
  kind: 'biology',
  date: d + 'T08:15:00Z',
  knownAt: d + 'T16:30:00Z',
  laboratory: i % 2 ? 'Laboratoire Atlas · fictif' : 'Laboratoire Horizon · fictif',
  pages: 1,
  status: 'available',
  synthetic: true,
}));
demoDocuments.push({
  id: 'report-2025-10-22',
  personId: PERSON_ALPHA,
  title: 'Compte rendu de bilan annuel · 2025',
  kind: 'report',
  date: '2025-10-22T09:00:00Z',
  knownAt: '2025-10-30T11:00:00Z',
  laboratory: 'Centre Convergence · fictif',
  pages: 1,
  status: 'available',
  synthetic: true,
});
demoDocuments.push({
  id: 'report-2026-10-28',
  personId: PERSON_ALPHA,
  title: 'Compte rendu de bilan annuel',
  kind: 'report',
  date: '2026-10-28T09:00:00Z',
  knownAt: '2026-11-05T11:00:00Z',
  laboratory: 'Centre Convergence · fictif',
  pages: 1,
  status: 'needs-review',
  synthetic: true,
});
export const demoObservations: Observation[] = dates.flatMap((d, i) =>
  labBiomarkers.map((b) => ({
    id: `${b.code}-${d}`,
    personId: PERSON_ALPHA,
    synthetic: true,
    code: b.code,
    value: values[b.code][i],
    unit: b.unit,
    measuredAt: d + 'T08:15:00Z',
    knownAt: d + 'T16:30:00Z',
    method: b.code === 'HBA1C' ? 'HPLC (jeu synthétique)' : 'Méthode simulée du laboratoire',
    sourceId: `lab-${d}`,
    quality: 'available',
    reference: {
      low: references[b.code][0],
      high: references[b.code][1],
      laboratory: demoDocuments[i].laboratory,
      unit: b.unit,
    },
    evidence: {
      documentId: `lab-${d}`,
      page: 1,
      sourceText: `${b.label} : ${values[b.code][i]} ${b.unit}`,
      method: 'synthetic-fixture',
      validation: 'synthetic-verified',
      processedAt: d + 'T16:30:00Z',
      confidence: null,
      originalValue: values[b.code][i],
      originalUnit: b.unit,
    },
  })),
);
const unitOf = (code: string) => centreMeasures.find((m) => m.code === code)!.unit;
demoObservations.push(
  ...centreVisits.flatMap((v, i) =>
    centreMeasures.map((m): Observation => ({
      id: `${m.code}-${v.date.slice(0, 10)}`,
      personId: PERSON_ALPHA,
      synthetic: true,
      code: m.code,
      value: centreValues[m.code][i],
      unit: unitOf(m.code),
      measuredAt: v.date,
      knownAt: v.knownAt,
      method: CENTRE_PROTOCOL[m.code],
      sourceId: v.id,
      quality: 'available',
      evidence: {
        documentId: v.id,
        page: 1,
        sourceText: `${m.label} : ${centreValues[m.code][i]} ${m.unit}`,
        method: 'synthetic-fixture',
        validation: 'synthetic-verified',
        processedAt: v.knownAt,
        confidence: null,
        originalValue: centreValues[m.code][i],
        originalUnit: m.unit,
      },
    })),
  ),
);
const isoAgo = (n: number, hour = 8) =>
  new Date(Date.parse('2026-11-18T00:00:00Z') - n * 86400000 + hour * 3600000).toISOString();
const activities: HealthRecord['activities'] = Array.from({ length: 90 }, (_, n) => n)
  .filter((n) => n % 7 === 0 || n % 7 === 2 || n % 7 === 4 || n % 7 === 5)
  .map((n, i) => {
    const sport =
      i % 5 === 1 ? 'cycling' : i % 7 === 3 ? 'walking' : i % 9 === 7 ? 'swimming' : 'running';
    const duration =
      sport === 'cycling'
        ? 74 + (n % 22)
        : sport === 'walking'
          ? 43 + (n % 12)
          : sport === 'swimming'
            ? 32 + (n % 11)
            : 38 + (n % 23);
    const distance =
      sport === 'cycling'
        ? Math.round(duration * 0.41 * 10) / 10
        : sport === 'walking'
          ? Math.round(duration * 0.078 * 10) / 10
          : sport === 'swimming'
            ? Math.round(duration * 0.037 * 10) / 10
            : Math.round(duration * 0.184 * 10) / 10;
    const samples = Array.from({ length: duration }, (_, m) => ({
      minute: m,
      heartRate: Math.round(
        (sport === 'walking' ? 98 : sport === 'cycling' ? 127 : 139) +
          10 * Math.sin(m / 7) +
          m / 30,
      ),
      speedKmh: (distance / duration) * 60,
      elevationM: sport === 'swimming' ? 0 : 20 + Math.round(7 * Math.sin(m / 13)),
    }));
    return {
      id: `activity-${n}`,
      title:
        sport === 'cycling'
          ? 'À vélo, le long du fleuve'
          : sport === 'walking'
            ? 'Marche en fin de journée'
            : sport === 'swimming'
              ? 'Natation · bassin de 25 m'
              : i % 3 === 0
                ? 'Course · sortie régulière'
                : 'Course · les quais de Bordeaux',
      sport,
      date: isoAgo(n, sport === 'walking' ? 18 : 8),
      knownAt: isoAgo(n, n === 0 ? 10 : 20),
      durationMinutes: duration,
      distanceKm: distance,
      ascentM: sport === 'swimming' ? 0 : 18 + (n % 55),
      avgHeartRate:
        sport === 'swimming'
          ? null
          : Math.round(samples.reduce((sum, p) => sum + p.heartRate, 0) / samples.length),
      device: 'Capteur de démonstration · série A',
      synthetic: true,
      samples,
    };
  });
const sleep: HealthRecord['sleep'] = Array.from({ length: 90 }, (_, n) => n)
  .filter((n) => n % 13 !== 6)
  .map((n) => ({
    id: `sleep-${n}`,
    date: isoAgo(n, 6),
    knownAt: isoAgo(n, 7),
    durationHours:
      Math.round((7.35 + 0.55 * Math.sin(n * 0.84) + 0.2 * Math.cos(n * 1.2)) * 100) / 100,
    restingHeartRate: Math.round((56 + 2.4 * Math.sin(n / 8) + 0.7 * Math.cos(n)) * 10) / 10,
    hrv: Math.round(47 + 5 * Math.sin(n / 6)),
    method: 'SDNN',
    device: 'Montre de démonstration · série A',
    synthetic: true,
  }));
export function baseRecord(personId = PERSON_ALPHA): HealthRecord {
  const empty = personId === PERSON_BETA;
  return {
    personId,
    synthetic: true,
    storage: 'synthetic-fixture+local-imports',
    asOf: DEMO_NOW,
    profile: empty
      ? { firstName: 'Camille', initials: 'CD', description: 'Profil fictif · dossier vide' }
      : { firstName: 'Alex', initials: 'AM', description: 'Profil fictif · Bordeaux' },
    biomarkers,
    observations: empty ? [] : structuredClone(demoObservations),
    documents: empty ? [] : structuredClone(demoDocuments),
    activities: empty ? [] : structuredClone(activities),
    sleep: empty ? [] : structuredClone(sleep),
    events: empty
      ? []
      : [
          {
            id: 'chapter-autumn',
            date: '2026-09-07T12:00:00Z',
            knownAt: '2026-09-08T12:00:00Z',
            title: 'Un nouveau rythme',
            description:
              'Reprise déclarée de sorties régulières. Contexte personnel, sans lien causal établi.',
            kind: 'declared',
            synthetic: true,
          },
          {
            id: 'trip',
            date: '2026-10-16T12:00:00Z',
            knownAt: '2026-11-07T12:00:00Z',
            title: 'Quelques jours en montagne',
            description:
              'Voyage déclaré a posteriori. Les données de montre sont incomplètes sur cette période.',
            kind: 'life',
            synthetic: true,
          },
        ],
  };
}
