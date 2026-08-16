import { z } from 'zod';
import { courseViaPoint } from '~/schema';

export type CourseViaPoint = typeof courseViaPoint.$inferSelect;
export type CourseViaPointInsert = typeof courseViaPoint.$inferInsert;
export type CourseViaPointWithMark = CourseViaPoint & {
  mark: { id: number; name: string; latitude: number; longitude: number } | null;
};

export const courseViaPointSchema: z.ZodType<CourseViaPoint> = z.object({
  id: z.number(),
  legStartCourseMarkId: z.number(),
  order: z.number(),
  markId: z.number().nullable(),
  name: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  note: z.string().nullable(),
});

export const courseViaPointInsertSchema: z.ZodType<CourseViaPointInsert> =
  z.object({
    legStartCourseMarkId: z.number(),
    order: z.number(),
    markId: z.number().nullable(),
    name: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    note: z.string().nullable(),
  });
