import { z } from 'zod';
import { courseMark } from '~/schema';

export type CourseMark = typeof courseMark.$inferSelect;
export type CourseMarkInsert = typeof courseMark.$inferInsert;

export const courseMarkDirection = z.enum(['port', 'starboard']).nullable();

export const courseMarkSchema: z.ZodType<CourseMark> = z.object({
  id: z.number(),
  courseId: z.number(),
  markId: z.number(),
  order: z.number(),
  direction: courseMarkDirection,
});

export const courseMarkInsertSchema: z.ZodType<CourseMarkInsert> = z.object({
  courseId: z.number(),
  markId: z.number(),
  order: z.number(),
  direction: courseMarkDirection,
});
