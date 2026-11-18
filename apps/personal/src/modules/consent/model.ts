import { z } from 'zod';
export const CONSENT_SOURCES = ['device-health', 'pdf-documents', 'structured-import'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];
export interface ConsentState {
  source: ConsentSource;
  granted: boolean;
  version: number;
  history: { version: number; granted: boolean; decidedBy: string; decidedAt: string }[];
}
export const ConsentRequestSchema = z.strictObject({
  source: z.enum(CONSENT_SOURCES),
  expectedVersion: z.number().int().min(0).max(1000),
  granted: z.boolean(),
});
export const CONSENT_LABEL: Record<ConsentSource, { title: string; detail: string }> = {
  'device-health': {
    title: 'Données santé du téléphone',
    detail:
      'Sommeil, FC au repos, VFC, pas et distance lus dans Santé (iPhone) ou Health Connect (Android), depuis l’application mobile.',
  },
  'pdf-documents': {
    title: 'Documents PDF',
    detail:
      'Lecture du texte natif des PDF synthétiques et ajout des résultats que vous choisissez.',
  },
  'structured-import': {
    title: 'Import structuré',
    detail: 'Ajout du fichier JSON synthétique de démonstration.',
  },
};
