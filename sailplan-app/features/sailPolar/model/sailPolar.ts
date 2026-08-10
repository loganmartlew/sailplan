import { z } from 'zod';
import { sailPolar } from '~/schema';

export type SailPolar = typeof sailPolar.$inferSelect;
export type SailPolarInsert = typeof sailPolar.$inferInsert;

export const sailPolarSourceKindSchema = z.enum(['manual', 'import', 'capture']);

export const sailPolarSchema: z.ZodType<SailPolar> = z.object({
  id: z.number(),
  tws: z.number(),
  twa: z.number(),
  speed: z.number(),
  sourceKind: sailPolarSourceKindSchema,
  captureSessionId: z.number().nullable(),
  importBatchId: z.number().nullable(),
  observationFingerprint: z.string().nullable(),
  sailId: z.number(),
});

export const sailPolarInsertSchema: z.ZodType<SailPolarInsert> = z.object({
  tws: z.number(),
  twa: z.number(),
  speed: z.number(),
  sourceKind: sailPolarSourceKindSchema,
  captureSessionId: z.number().nullable(),
  importBatchId: z.number().nullable(),
  observationFingerprint: z.string().nullable(),
  sailId: z.number(),
});
