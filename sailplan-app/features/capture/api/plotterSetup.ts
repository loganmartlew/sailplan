import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { ManualPlotterSetupFormValues } from '~/features/capture/model/plotterSetup';
import type { PlotterSetup } from '~/features/capture/model/capture';
import { db } from '~/lib/db';
import { plotterSetup } from '~/schema';

export function usePlotterSetup(boatProfileId: number | null) {
  const activeBoatProfileId = boatProfileId ?? -1;

  return useLiveQuery(
    db.query.plotterSetup.findFirst({
      where: eq(plotterSetup.boatProfileId, activeBoatProfileId),
    }),
    [activeBoatProfileId],
  );
}

export async function saveManualPlotterSetup(
  boatProfileId: number,
  { host, port }: ManualPlotterSetupFormValues,
): Promise<PlotterSetup> {
  const existing = await db.query.plotterSetup.findFirst({
    where: eq(plotterSetup.boatProfileId, boatProfileId),
  });
  const endpointChanged =
    existing?.mode !== 'manual' ||
    existing.host !== host ||
    existing.port !== port;

  const saved = await db
    .insert(plotterSetup)
    .values({
      boatProfileId,
      mode: 'manual',
      sourceName: null,
      sourceModel: null,
      cachedHost: null,
      cachedPort: null,
      host,
      port,
      lastTestedAt: null,
    })
    .onConflictDoUpdate({
      target: plotterSetup.boatProfileId,
      set: {
        mode: 'manual',
        sourceName: null,
        sourceModel: null,
        cachedHost: null,
        cachedPort: null,
        host,
        port,
        ...(endpointChanged ? { lastTestedAt: null } : {}),
      },
    })
    .returning();

  return saved[0];
}

/** Record only a successful connection test. A failed test must remain visible
 * as the previous successful test (or "Not tested"), not invalidate setup. */
export async function markPlotterSetupTested(
  boatProfileId: number,
  testedAt: number = Date.now(),
): Promise<void> {
  await db
    .update(plotterSetup)
    .set({ lastTestedAt: testedAt })
    .where(eq(plotterSetup.boatProfileId, boatProfileId));
}
