import { z } from 'zod';
import { Mark } from '~/features/mark';
import { courseMark } from '~/schema';
import { CourseViaPointWithMark } from './courseViaPoint';

export type CourseMark = typeof courseMark.$inferSelect;
export type CourseMarkInsert = typeof courseMark.$inferInsert;
export type CourseMarkWithMark = CourseMark & { mark: Mark };
export type CourseMarkWithRouteData = CourseMark & {
  mark: Mark | null;
  viaPoints: CourseViaPointWithMark[];
};

export const courseMarkDirection = z.enum(['port', 'starboard']).nullable();

export const courseMarkSchema: z.ZodType<CourseMark> = z.object({
  id: z.number(),
  courseId: z.number(),
  markId: z.number(),
  order: z.number(),
  direction: courseMarkDirection,
  note: z.string().nullable(),
});

export const courseMarkInsertSchema: z.ZodType<CourseMarkInsert> = z.object({
  courseId: z.number(),
  markId: z.number(),
  order: z.number(),
  direction: courseMarkDirection,
  note: z.string().nullable(),
});
