import { z } from 'zod';
export const PERSON_ALPHA = 'demo-alpha';
export const PERSON_BETA = 'demo-beta';
export const DEMO_NOW = '2026-11-18T12:00:00Z';
export type View = 'overview' | 'biology' | 'sport' | 'documents' | 'timeline' | 'settings';
export type Period = 30 | 90 | 365 | 0;
export const EvidenceSchema = z.object({
  documentId: z.string(),
  page: z.number().int().positive(),
  sourceText: z.string(),
  method: z.enum([
    'synthetic-fixture',
    'structured-import',
    'device-export',
    'declared',
    'native-pdf',
  ]),
  validation: z.enum(['synthetic-verified', 'needs-review', 'declared']),
  processedAt: z.iso.datetime(),
  confidence: z.null(),
  originalValue: z.number(),
  originalUnit: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
/** One immutable correction version; the original value stays in `evidence.originalValue`. */
export const CorrectionSchema = z.object({
  version: z.number().int().positive(),
  value: z.number().finite(),
  unit: z.string(),
  reason: z.string(),
  correctedBy: z.string(),
  correctedAt: z.iso.datetime(),
});
export type Correction = z.infer<typeof CorrectionSchema>;
export const ObservationSchema = z.object({
  id: z.string(),
  personId: z.literal(PERSON_ALPHA),
  synthetic: z.literal(true),
  code: z.string(),
  value: z.number().finite(),
  unit: z.string(),
  measuredAt: z.iso.datetime(),
  measuredPrecision: z.enum(['day', 'instant']).optional(),
  knownAt: z.iso.datetime(),
  method: z.string(),
  sourceId: z.string(),
  quality: z.enum(['available', 'needs-review']),
  evidence: EvidenceSchema,
  reference: z
    .object({ low: z.number(), high: z.number(), laboratory: z.string(), unit: z.string() })
    .optional(),
  /** Read model only (PostgreSQL): history, oldest first; `value` is then the last version. */
  corrections: z.array(CorrectionSchema).optional(),
});
export type Observation = z.infer<typeof ObservationSchema>;
export interface Biomarker {
  code: string;
  label: string;
  shortLabel: string;
  category: string;
  unit: string;
  color: string;
  decimals: number;
}
export interface HealthDocument {
  id: string;
  personId: string;
  title: string;
  kind: 'biology' | 'report';
  date: string;
  datePrecision?: 'day' | 'instant';
  knownAt: string;
  laboratory: string;
  pages: number;
  status: 'available' | 'needs-review' | 'error';
  synthetic: true;
}
export interface Activity {
  id: string;
  title: string;
  sport: 'running' | 'cycling' | 'walking' | 'swimming';
  date: string;
  knownAt: string;
  durationMinutes: number;
  distanceKm: number;
  ascentM: number;
  avgHeartRate: number | null;
  device: string;
  synthetic: true;
  samples: { minute: number; heartRate: number; speedKmh: number; elevationM: number }[];
}
export interface SleepSession {
  id: string;
  date: string;
  knownAt: string;
  durationHours: number;
  restingHeartRate: number;
  hrv: number;
  method: 'SDNN';
  device: string;
  synthetic: true;
}
export interface LifeEvent {
  id: string;
  date: string;
  knownAt: string;
  title: string;
  description: string;
  kind: 'life' | 'declared';
  synthetic: true;
}
export interface TimelineItem {
  id: string;
  date: string;
  knownAt: string;
  title: string;
  detail: string;
  kind: 'biology' | 'sport' | 'sleep' | 'life' | 'document' | 'declared';
  documentId?: string;
  activityId?: string;
}
export interface HealthRecord {
  personId: string;
  synthetic: true;
  storage: 'synthetic-fixture+local-imports' | 'postgresql';
  asOf: string;
  profile: { firstName: string; initials: string; description: string };
  biomarkers: Biomarker[];
  observations: Observation[];
  documents: HealthDocument[];
  activities: Activity[];
  sleep: SleepSession[];
  events: LifeEvent[];
}
