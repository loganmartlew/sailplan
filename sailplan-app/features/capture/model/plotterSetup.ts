import { z } from 'zod';

/**
 * Manual endpoints are deliberately permissive: plotters can be named hosts,
 * private IPv4 addresses, or link-local addresses. Reachability is checked
 * separately and never decides whether the setup can be saved.
 */
export const manualPlotterSetupFormSchema = z.object({
  host: z
    .string()
    .trim()
    .min(1, 'Host is required')
    .refine(value => !/\s/.test(value), 'Host cannot contain spaces'),
  port: z.coerce
    .number({ message: 'Port is required' })
    .int('Port must be a whole number')
    .min(1, 'Port must be between 1 and 65535')
    .max(65535, 'Port must be between 1 and 65535'),
});

export type ManualPlotterSetupFormValues = z.infer<
  typeof manualPlotterSetupFormSchema
>;
