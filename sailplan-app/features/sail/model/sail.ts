import { z } from 'zod';
import { sail } from '~/schema';

export type Sail = typeof sail.$inferSelect;
export type SailInsert = typeof sail.$inferInsert;

/**
 * Validates the per-sail usable wind-speed range (knots). Either bound may be
 * null (unbounded on that side); when both are set, min must be ≤ max. Values
 * are free numeric — not snapped to the TWS_VALUES grid — so a real-world
 * ceiling like 18 kt is expressible (Package I / decision D5).
 */
export const sailWindRangeSchema = z
  .object({
    minTws: z.number().min(0).nullable(),
    maxTws: z.number().min(0).nullable(),
  })
  .refine(
    data => data.minTws == null || data.maxTws == null || data.minTws <= data.maxTws,
    { message: 'Min wind must be ≤ Max wind', path: ['minTws'] },
  );

export type SailWindRange = z.infer<typeof sailWindRangeSchema>;
