import type { SailSpanInsert } from '../model/capture';
import type { EditableSailSpan } from './spanEditing';

/**
 * The rows a confirm writes for one stored leg part.
 *
 * Editable spans are the stored rows themselves, so they still carry `id` —
 * and every operation that makes a block out of another one (`splitSpan`,
 * `mergeSpan`) spreads that block. Two halves of a split therefore share one
 * id, and spreading a span straight into an insert fails with
 * `UNIQUE constraint failed: sailSpan.id`. Naming the columns is what stops
 * that: identity belongs to the table, never to a block on screen.
 *
 * Whether the leg is used at all is `sailedLeg.used`, not something these rows
 * encode. Striking a leg out must not cost the sailor the sail assignments
 * they made on it.
 */
export function sailSpanInsertsFor({
  sailedLegId,
  spans,
}: {
  sailedLegId: number;
  spans: readonly EditableSailSpan[];
}): SailSpanInsert[] {
  return spans
    // A no-data block is a picture of time no row covers.
    .filter(span => span.gap !== true)
    .map(span => ({
      sailedLegId,
      startTime: span.startTime,
      endTime: span.endTime,
      sailId: span.sailId,
    }));
}
