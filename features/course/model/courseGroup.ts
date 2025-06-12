import { z } from 'zod';
import { courseGroup } from '~/schema';

export type CourseGroup = typeof courseGroup.$inferSelect;
export type CourseGroupInsert = typeof courseGroup.$inferInsert;

export const courseGroupSchema: z.ZodType<CourseGroup> = z.object({
  id: z.number(),
  name: z.string(),
});

export const courseGroupInsertSchema: z.ZodType<CourseGroupInsert> = z.object({
  name: z.string(),
});
