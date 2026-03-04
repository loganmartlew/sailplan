import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { sailTwaLimit } from '~/schema';

export async function deleteSailTwaLimits(sailId: number): Promise<void> {
  await db.delete(sailTwaLimit).where(eq(sailTwaLimit.sailId, sailId));
}
