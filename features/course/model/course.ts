import { z } from 'zod';
import { course } from '~/schema';

export type Course = typeof course.$inferSelect;
export type CourseInsert = typeof course.$inferInsert;

export const courseSchema: z.ZodType<Course> = z.object({
  id: z.number(),
  name: z.string(),
  courseGroupId: z.number().nullable(),
});

export const courseInsertSchema: z.ZodType<CourseInsert> = z.object({
  name: z.string(),
  courseGroupId: z.number().nullable(),
});
