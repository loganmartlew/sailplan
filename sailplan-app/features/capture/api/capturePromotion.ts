import { useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useBoatProfile } from '~/features/boatProfile';
import {
  replaceCapturePolarPoints,
  type CapturePolarPoint,
} from '~/features/sailPolar';
import { db } from '~/lib/db';
import { captureSample, sail, sailedLeg, sailPolar } from '~/schema';
import {
  confirmedSpans,
  proposePolarPoints,
  type ProposedPolarPoint,
} from '../util/promotion';
import {
  comparePromotionWithTable,
  type PromotionComparisonRow,
} from '../util/promotionReview';
import { findSteadyStretches } from '../util/steadyState';

/**
 * What this session would contribute, and how it compares with the table it
 * would join. Nothing here writes: promotion is a decision the sailor makes
 * having seen this, not a side effect of finishing review.
 *
 * The stored table is read **without** this session's own earlier points, since
 * promoting again replaces them — comparing a re-promotion against itself would
 * report a delta of zero and call the race unremarkable.
 */
export function useCapturePromotion(sessionId: number) {
  const { boatProfile } = useBoatProfile();
  const boatProfileId = boatProfile?.id ?? -1;
  const legs = useLiveQuery(
    db.query.sailedLeg.findMany({
      where: eq(sailedLeg.captureSessionId, sessionId),
      orderBy: [asc(sailedLeg.startTime)],
      with: { sailSpans: true },
    }),
    [sessionId],
  );
  const samples = useLiveQuery(
    db.query.captureSample.findMany({
      where: eq(captureSample.captureSessionId, sessionId),
      orderBy: [asc(captureSample.timestamp)],
    }),
    [sessionId],
  );
  const storedPoints = useLiveQuery(
    db
      .select({
        sailId: sailPolar.sailId,
        tws: sailPolar.tws,
        twa: sailPolar.twa,
        speed: sailPolar.speed,
        sourceKind: sailPolar.sourceKind,
        captureSessionId: sailPolar.captureSessionId,
      })
      .from(sailPolar)
      .innerJoin(sail, eq(sail.id, sailPolar.sailId))
      .where(eq(sail.boatProfileId, boatProfileId)),
    [boatProfileId],
  );

  // The mask and the binning are a synchronous pass over every sample in the
  // session, which on a two-hour race is long enough to be felt. The review
  // pager defers its own materialisation for the same reason; computing here
  // during the first render would spend that cost on the screen's entry
  // animation instead.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const task = InteractionManager.runAfterInteractions(() => setSettled(true));
    return () => task.cancel();
  }, [sessionId]);

  const points = useMemo(
    () =>
      settled
        ? proposePolarPoints(
            samples.data,
            confirmedSpans(legs.data),
            findSteadyStretches(samples.data),
          )
        : [],
    [settled, samples.data, legs.data],
  );
  const comparison = useMemo(
    () =>
      comparePromotionWithTable(
        points,
        storedPoints.data.filter(point => point.captureSessionId !== sessionId),
      ),
    [points, storedPoints.data, sessionId],
  );

  return {
    points,
    comparison,
    // Counted by ordinal, not by row: a leg interrupted by a data gap is
    // stored as several rows and reviewed — and counted — as one leg.
    confirmedLegCount: new Set(
      legs.data.filter(leg => leg.confirmedAt !== null).map(leg => leg.ordinal),
    ).size,
    legCount: new Set(legs.data.map(leg => leg.ordinal)).size,
    /** Points this session has already contributed, from an earlier promotion. */
    promotedPointCount: storedPoints.data.filter(
      point => point.captureSessionId === sessionId,
    ).length,
    loading:
      !settled
      || legs.updatedAt === undefined
      || samples.updatedAt === undefined
      || storedPoints.updatedAt === undefined,
  };
}

export type { PromotionComparisonRow };

/**
 * Writes the proposal the sailor just agreed to, replacing any earlier one.
 *
 * The narrowing is the point of this step: a proposal carries the leg it came
 * from and the evidence behind it, and the table stores neither — `15` declined
 * to spend a contributing count, so a stored one would be a column nothing
 * reads. Returns the rows that landed.
 */
export async function promoteCaptureSession(
  sessionId: number,
  points: readonly ProposedPolarPoint[],
) {
  const rows: CapturePolarPoint[] = points.map(point => ({
    sailId: point.sailId,
    tws: point.tws,
    twa: point.twa,
    speed: point.speed,
  }));
  return replaceCapturePolarPoints(sessionId, rows);
}
