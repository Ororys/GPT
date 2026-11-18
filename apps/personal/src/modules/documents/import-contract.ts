import { z } from 'zod';
import { ObservationSchema, PERSON_ALPHA } from '../health-records/model';
export const ImportSchema = z.strictObject({
  schemaVersion: z.literal(1),
  synthetic: z.literal(true),
  personId: z.literal(PERSON_ALPHA),
  batchId: z.literal('demo-lab-2026-11-18'),
  observations: z.array(ObservationSchema).min(1).max(100),
});
export const importTemplate: z.infer<typeof ImportSchema> = {
  schemaVersion: 1,
  synthetic: true,
  personId: PERSON_ALPHA,
  batchId: 'demo-lab-2026-11-18',
  observations: [
    {
      id: 'FERRITIN-2026-11-18',
      personId: PERSON_ALPHA,
      synthetic: true,
      code: 'FERRITIN',
      value: 63,
      unit: 'µg/L',
      measuredAt: '2026-11-18T08:15:00Z',
      knownAt: '2026-11-18T10:00:00Z',
      method: 'Méthode simulée du laboratoire',
      sourceId: 'lab-2026-11-18',
      quality: 'needs-review',
      reference: { low: 30, high: 300, laboratory: 'Laboratoire Atlas · fictif', unit: 'µg/L' },
      evidence: {
        documentId: 'lab-2026-11-18',
        page: 1,
        sourceText: 'Ferritine : 63 µg/L',
        method: 'structured-import',
        validation: 'needs-review',
        processedAt: '2026-11-18T10:00:00Z',
        confidence: null,
        originalValue: 63,
        originalUnit: 'µg/L',
      },
    },
  ],
};
export const TEMPLATE_TEXT = JSON.stringify(importTemplate, null, 2) + '\n';
