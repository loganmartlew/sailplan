import { z } from 'zod';
import {
  captureSample,
  captureSession,
  connectionEvent,
  plotterSetup,
  sailedLeg,
  sailSpan,
  sailStamp,
} from '~/schema';

export type CaptureSession = typeof captureSession.$inferSelect;
export type CaptureSessionInsert = typeof captureSession.$inferInsert;
export type CaptureSample = typeof captureSample.$inferSelect;
export type CaptureSampleInsert = typeof captureSample.$inferInsert;
export type ConnectionEvent = typeof connectionEvent.$inferSelect;
export type ConnectionEventInsert = typeof connectionEvent.$inferInsert;
export type SailStamp = typeof sailStamp.$inferSelect;
export type SailStampInsert = typeof sailStamp.$inferInsert;
export type SailedLeg = typeof sailedLeg.$inferSelect;
export type SailedLegInsert = typeof sailedLeg.$inferInsert;
export type SailSpan = typeof sailSpan.$inferSelect;
export type SailSpanInsert = typeof sailSpan.$inferInsert;
export type PlotterSetup = typeof plotterSetup.$inferSelect;
export type PlotterSetupInsert = typeof plotterSetup.$inferInsert;

export const captureSessionStatusSchema = z.enum(['active', 'ended', 'autoEnded']);
export type CaptureSessionStatus = z.infer<typeof captureSessionStatusSchema>;
export const windFrameSchema = z.enum(['water', 'ground', 'instrument-corrected', 'unknown']).nullable();
export const plotterSetupModeSchema = z.enum(['automatic', 'manual']);

export const captureSessionSchema: z.ZodType<CaptureSession> = z.object({
  id: z.number(), boatProfileId: z.number(), name: z.string(), courseId: z.number().nullable(),
  startedAt: z.number(), endedAt: z.number().nullable(), status: captureSessionStatusSchema,
  resumeDismissedAt: z.number().nullable(), rawLogPath: z.string().nullable(), windFrame: windFrameSchema,
  healthCounters: z.string(), notes: z.string(),
});
export const captureSessionInsertSchema: z.ZodType<CaptureSessionInsert> = z.object({
  boatProfileId: z.number(), name: z.string(), courseId: z.number().nullable(), startedAt: z.number(),
  endedAt: z.number().nullable(), status: captureSessionStatusSchema, resumeDismissedAt: z.number().nullable(),
  rawLogPath: z.string().nullable(), windFrame: windFrameSchema, healthCounters: z.string(), notes: z.string(),
});

const nullableNumber = z.number().nullable();
export const captureSampleSchema: z.ZodType<CaptureSample> = z.object({
  id: z.number(), captureSessionId: z.number(), timestamp: z.number(), gpsTime: nullableNumber,
  tws: nullableNumber, twa: nullableNumber, twd: nullableNumber, stw: nullableNumber, sog: nullableNumber,
  cog: nullableNumber, hdg: nullableNumber, variation: nullableNumber, awa: nullableNumber, aws: nullableNumber,
  heel: nullableNumber, trim: nullableNumber, lat: nullableNumber, lon: nullableNumber, rawOffset: nullableNumber,
});
export const captureSampleInsertSchema: z.ZodType<CaptureSampleInsert> = z.object({
  captureSessionId: z.number(), timestamp: z.number(), gpsTime: nullableNumber, tws: nullableNumber,
  twa: nullableNumber, twd: nullableNumber, stw: nullableNumber, sog: nullableNumber, cog: nullableNumber,
  hdg: nullableNumber, variation: nullableNumber, awa: nullableNumber, aws: nullableNumber, heel: nullableNumber,
  trim: nullableNumber, lat: nullableNumber, lon: nullableNumber, rawOffset: nullableNumber,
});

export const connectionEventSchema: z.ZodType<ConnectionEvent> = z.object({
  id: z.number(), captureSessionId: z.number(), at: z.number(), kind: z.string(),
});
export const connectionEventInsertSchema: z.ZodType<ConnectionEventInsert> = z.object({
  captureSessionId: z.number(), at: z.number(), kind: z.string(),
});
export const sailStampSchema: z.ZodType<SailStamp> = z.object({
  id: z.number(), captureSessionId: z.number(), sailId: z.number(), timestamp: z.number(),
});
export const sailStampInsertSchema: z.ZodType<SailStampInsert> = z.object({
  captureSessionId: z.number(), sailId: z.number(), timestamp: z.number(),
});
export const sailedLegSchema: z.ZodType<SailedLeg> = z.object({
  id: z.number(), captureSessionId: z.number(), ordinal: z.number(), startTime: z.number(), endTime: z.number(),
  name: z.string().nullable(), courseMarkId: z.number().nullable(), confirmedAt: z.number().nullable(),
});
export const sailedLegInsertSchema: z.ZodType<SailedLegInsert> = z.object({
  captureSessionId: z.number(), ordinal: z.number(), startTime: z.number(), endTime: z.number(),
  name: z.string().nullable(), courseMarkId: z.number().nullable(), confirmedAt: z.number().nullable(),
});
export const sailSpanSchema: z.ZodType<SailSpan> = z.object({
  id: z.number(), sailedLegId: z.number(), startTime: z.number(), endTime: z.number(), sailId: z.number().nullable(),
});
export const sailSpanInsertSchema: z.ZodType<SailSpanInsert> = z.object({
  sailedLegId: z.number(), startTime: z.number(), endTime: z.number(), sailId: z.number().nullable(),
});
export const plotterSetupSchema: z.ZodType<PlotterSetup> = z.object({
  id: z.number(), boatProfileId: z.number(), mode: plotterSetupModeSchema, sourceName: z.string().nullable(),
  sourceModel: z.string().nullable(), cachedHost: z.string().nullable(), cachedPort: z.number().nullable(),
  host: z.string().nullable(), port: z.number().nullable(), lastTestedAt: z.number().nullable(),
});
export const plotterSetupInsertSchema: z.ZodType<PlotterSetupInsert> = z.object({
  boatProfileId: z.number(), mode: plotterSetupModeSchema, sourceName: z.string().nullable(),
  sourceModel: z.string().nullable(), cachedHost: z.string().nullable(), cachedPort: z.number().nullable(),
  host: z.string().nullable(), port: z.number().nullable(), lastTestedAt: z.number().nullable(),
});
