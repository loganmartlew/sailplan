import { z } from 'zod';
import { courseSchema } from '~/features/course';

export const coursePlanDataSchema = z.object({
  // tws: z.number().int().min(0).optional(),
  twd: z.number().int().min(0).max(360),
  course: courseSchema,
});

export type CoursePlanData = z.infer<typeof coursePlanDataSchema>;

export const serializeCoursePlanData = (data: CoursePlanData): string => {
  const planData = coursePlanDataSchema.parse(data);
  return JSON.stringify(planData);
};

export const deserializeCoursePlanData = (data: string): CoursePlanData => {
  const planData = JSON.parse(data);
  return coursePlanDataSchema.parse(planData);
};
