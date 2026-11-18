import { z } from 'zod';
/** French decimal comma accepted; no unit field: a correction never converts units. */
export const CorrectionRequestSchema = z.strictObject({
  observationId: z.string().min(1).max(200),
  expectedVersion: z.number().int().min(0).max(50),
  value: z
    .string()
    .trim()
    .regex(/^\d{1,9}(?:[.,]\d{1,6})?$/)
    .transform((v) => Number(v.replace(',', '.'))),
  reason: z.string().trim().min(3).max(300),
});
export type CorrectionRequest = z.infer<typeof CorrectionRequestSchema>;
