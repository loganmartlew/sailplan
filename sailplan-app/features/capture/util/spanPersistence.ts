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
 */
export function sailSpanInsertsFor({
  sailedLegId,
  spans,
  used,
}: {
  sailedLegId: number;
  spans: readonly EditableSailSpan[];
  used: boolean;
}): SailSpanInsert[] {
  return spans
    // A no-data block is a picture of time no row covers.
    .filter(span => span.gap !== true)
    .map(span => ({
      sailedLegId,
      startTime: span.startTime,
      endTime: span.endTime,
      sailId: used ? span.sailId : null,
    }));
}
