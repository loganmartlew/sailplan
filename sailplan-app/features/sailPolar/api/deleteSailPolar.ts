import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { sailPolar } from '~/schema';

export async function deleteSailPolar(id: number): Promise<void> {
  await db.delete(sailPolar).where(eq(sailPolar.id, id));
}

export async function deleteAllSailPolars(sailId: number): Promise<void> {
  await db.delete(sailPolar).where(eq(sailPolar.sailId, sailId));
}
