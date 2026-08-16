/**
 * Route rows carry contiguous `order` per Leg with no unique index, so reads
 * sort `order, id` and any tie degrades to insertion order (ADR-0001 rule 1).
 * The Drizzle equivalents live next to the queries in `api/courseRoute.ts`.
 */
export function byOrderThenId<T extends { id: number; order: number }>(
  a: T,
  b: T,
): number {
  return a.order - b.order || a.id - b.id;
}

export function sortByOrderThenId<T extends { id: number; order: number }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(byOrderThenId);
}
