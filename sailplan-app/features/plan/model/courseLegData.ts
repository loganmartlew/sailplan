import { z } from 'zod';

const courseLegMarkSchema = z.object({
  name: z.string(),
  direction: z.enum(['port', 'starboard']).nullable(),
});

export const courseLegDataSchema = z.object({
  from: courseLegMarkSchema,
  to: courseLegMarkSchema,
  bearing: z.number(),
  twa: z.object({
    angle: z.number(),
    tack: z.enum(['port', 'starboard']).nullable(),
  }),
  tws: z.number(),
});

export type CourseLegData = z.infer<typeof courseLegDataSchema>;

export const serializeCourseLegData = (data: CourseLegData): string => {
  const legData = courseLegDataSchema.parse(data);
  return JSON.stringify(legData);
};

export const deserializeCourseLegData = (data: string): CourseLegData => {
  const legData = JSON.parse(data);
  return courseLegDataSchema.parse(legData);
};
