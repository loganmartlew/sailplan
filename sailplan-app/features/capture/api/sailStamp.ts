import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { sailStamp } from '~/schema';
import type { SailStamp } from '../model/capture';

export async function createSailStamp(
  captureSessionId: number,
  sailId: number,
  timestamp = Date.now(),
): Promise<SailStamp> {
  const rows = await db
    .insert(sailStamp)
    .values({ captureSessionId, sailId, timestamp })
    .returning();
  return rows[0];
}

export async function deleteSailStamp(id: number): Promise<void> {
  await db.delete(sailStamp).where(eq(sailStamp.id, id));
}
