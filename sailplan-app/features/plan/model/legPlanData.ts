import { z } from 'zod';
import { markSchema } from '~/features/mark';

export const legPlanDataSchema = z.object({
  from: markSchema,
  to: markSchema,
});

export type LegPlanData = z.infer<typeof legPlanDataSchema>;

export const serializeLegPlanData = (data: LegPlanData): string => {
  const planData = legPlanDataSchema.parse(data);
  return JSON.stringify(planData);
};

export const deserializeLegPlanData = (data: string): LegPlanData => {
  const planData = JSON.parse(data);
  return legPlanDataSchema.parse(planData);
};
