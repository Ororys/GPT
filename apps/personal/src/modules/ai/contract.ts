import { z } from 'zod';
/**
 * Reading a lab PDF with an online AI (OpenAI), decided by the founder on 19 November 2026.
 * The AI only TRANSCRIBES what is printed and files each line under a category: no
 * interpretation, no flag, no comment (V1 strictly descriptive, DESTINATION_PREVUE.md).
 * Shared by the relay (apps/relay) and the app, which re-checks everything it receives.
 */
/** Version of the text shown before each sending; recorded with the permission. */
export const AI_NOTICE_VERSION = '2026-11-19';
export const AI_PROVIDER = 'OpenAI';
export const AI_METHOD = 'ai-transcription-v1';
export const MAX_AI_PDF_BYTES = 10 * 1024 * 1024;
/** Filing categories (sorting only, never a judgement). */
export const AI_CATEGORIES = [
  'Hématologie',
  'Glycémie',
  'Lipides',
  'Fonction rénale',
  'Foie et enzymes',
  'Ions et minéraux',
  'Statut martial',
  'Vitamines',
  'Thyroïde',
  'Hormones',
  'Inflammation',
  'Urines',
  'Autres paramètres',
] as const;
/** Parameters already in the catalog; anything else becomes a series of its own. */
export const AI_CATALOG_CODES = [
  'FERRITIN',
  'LDL_C',
  'HBA1C',
  'CREATININE',
  'VITD',
  'HEMOGLOBIN',
  'NONE',
] as const;
export const AI_INSTRUCTIONS = `Tu recopies un compte rendu de biologie médicale. Tu ne l'interprètes jamais.
Règles :
- Recopie chaque résultat exactement comme il est imprimé : libellé, valeur, unité, valeurs de référence, page (1 = première page).
- N'ajoute aucun commentaire, aucun avis, aucune indication normal/anormal, aucune flèche, aucune couleur, aucun conseil.
- Ne convertis aucune unité, ne recalcule rien, ne corrige rien, ne devine rien. Si une information n'est pas imprimée, mets null.
- La valeur est la chaîne imprimée (par exemple "5,2", "1 250", "< 0,5").
- catalogCode : le code correspondant seulement si le paramètre est exactement l'un de ceux-ci, sinon NONE : FERRITIN (ferritine), LDL_C (LDL-cholestérol), HBA1C (hémoglobine glyquée), CREATININE (créatinine sanguine), VITD (25-OH vitamine D), HEMOGLOBIN (hémoglobine).
- category : la rubrique de classement la plus proche dans la liste fournie, sans jugement.
- printedDate : la date de prélèvement telle qu'imprimée, sinon null.
- Ignore les noms, adresses, numéros de dossier et toute donnée d'identité : ne les recopie pas.`;
/**
 * JSON Schema sent as structured output (strict). Only basic keywords, the most widely
 * supported in strict mode; lengths and bounds are enforced afterwards by AiReadingSchema.
 */
const nullableString = { type: ['string', 'null'] };
export const AI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['printedDate', 'laboratory', 'results'],
  properties: {
    printedDate: nullableString,
    laboratory: nullableString,
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value', 'unit', 'referenceText', 'page', 'catalogCode', 'category'],
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          unit: nullableString,
          referenceText: nullableString,
          page: { type: 'integer' },
          catalogCode: { type: 'string', enum: [...AI_CATALOG_CODES] },
          category: { type: 'string', enum: [...AI_CATEGORIES] },
        },
      },
    },
  },
} as const;
export const AiResultSchema = z.strictObject({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(40),
  unit: z.string().trim().max(30).nullable(),
  referenceText: z.string().trim().max(80).nullable(),
  page: z.number().int().min(1).max(200),
  catalogCode: z.enum(AI_CATALOG_CODES),
  category: z.enum(AI_CATEGORIES),
});
export const AiReadingSchema = z.strictObject({
  printedDate: z.string().max(40).nullable(),
  laboratory: z.string().max(120).nullable(),
  results: z.array(AiResultSchema).max(200),
});
export type AiReading = z.infer<typeof AiReadingSchema>;
export type AiResult = z.infer<typeof AiResultSchema>;
/** What the relay returns to the app. */
export interface AiReadingResponse {
  provider: typeof AI_PROVIDER;
  model: string;
  reading: AiReading;
}
