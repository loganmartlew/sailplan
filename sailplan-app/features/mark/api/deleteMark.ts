import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { mark } from '~/schema';
import { getMarkRouteUsage } from '~/features/course/api/markRouteUsage';
import { describeMarkRouteUsage } from '~/features/course/util/describeMarkRouteUsage';

export class MarkInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkInUseError';
  }
}

/**
 * Refuses while any Course still routes through the Mark (ADR-0001 rule 4).
 * Without this guard the only thing standing between a sailor and a broken
 * Course is the foreign key, which surfaces as a raw SQLite error.
 */
export async function deleteMark(id: number): Promise<void> {
  const usage = await getMarkRouteUsage(id);
  const refusal = describeMarkRouteUsage(usage);
  if (refusal) throw new MarkInUseError(refusal);

  await db.delete(mark).where(eq(mark.id, id));
}
