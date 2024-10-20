import { z } from 'zod';
import { markSchema } from '~/features/mark';

export const planDataSchema = z.object({
  tws: z.number().int().min(0),
  twd: z.number().int().min(0).max(360),
  from: markSchema,
  to: markSchema,
});

export type PlanData = z.infer<typeof planDataSchema>;

export const serializePlanData = (data: PlanData): string => {
  const planData = planDataSchema.parse(data);
  return JSON.stringify(planData);
};

export const deserializePlanData = (data: string): PlanData => {
  const planData = JSON.parse(data);
  return planDataSchema.parse(planData);
};
