import { and, eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { sailPolar } from '~/schema';
import type { SailPolar } from '../model/sailPolar';

/** One promoted point, as the table stores it. */
export interface CapturePolarPoint {
  sailId: number;
  tws: number;
  twa: number;
  speed: number;
}

/**
 * Promotion's one write. Every captured point enters the table here, with its
 * provenance set explicitly — `sourceKind` has no ORM-level default precisely so
 * a second writer that forgot it would fail loudly rather than file a race as
 * hand-entered.
 *
 * A session's points are **replaced**, not accumulated: re-reviewing a race and
 * promoting it again must not double-count it, and withdrawal is already scoped
 * to the whole session, which is why there is no promotion batch to own them.
 * Delete and insert share one transaction, so a session is never left holding
 * half of two promotions.
 *
 * Promoting nothing is a legitimate outcome — it withdraws the session's earlier
 * contribution and writes none of its own.
 */
export async function replaceCapturePolarPoints(
  captureSessionId: number,
  points: readonly CapturePolarPoint[],
): Promise<SailPolar[]> {
  return db.transaction(tx => {
    tx.delete(sailPolar)
      .where(
        and(
          eq(sailPolar.captureSessionId, captureSessionId),
          eq(sailPolar.sourceKind, 'capture'),
        ),
      )
      .run();
    if (points.length === 0) return [];
    return tx
      .insert(sailPolar)
      .values(
        points.map(point => ({
          ...point,
          sourceKind: 'capture' as const,
          captureSessionId,
        })),
      )
      .returning()
      .all();
  });
}
