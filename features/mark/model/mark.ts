import { z } from 'zod';
import { mark } from '~/schema';

export type Mark = typeof mark.$inferSelect;
export type MarkInsert = typeof mark.$inferInsert;

export const markSchema: z.ZodType<Mark> = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});
