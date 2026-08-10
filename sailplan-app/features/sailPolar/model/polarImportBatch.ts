import { z } from 'zod';
import { polarImportBatch } from '~/schema';

export type PolarImportBatch = typeof polarImportBatch.$inferSelect;
export type PolarImportBatchInsert = typeof polarImportBatch.$inferInsert;

export const polarImportBatchSchema: z.ZodType<PolarImportBatch> = z.object({
  id: z.number(),
  boatProfileId: z.number(),
  importedAt: z.number(),
  fileName: z.string(),
  batchFingerprint: z.string(),
  rowCount: z.number(),
});

export const polarImportBatchInsertSchema: z.ZodType<PolarImportBatchInsert> =
  z.object({
    boatProfileId: z.number(),
    importedAt: z.number(),
    fileName: z.string(),
    batchFingerprint: z.string(),
    rowCount: z.number(),
  });
