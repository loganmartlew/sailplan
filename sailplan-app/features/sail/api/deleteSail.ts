import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { sail, sailPolar } from '~/schema';

export async function deleteSail(id: number): Promise<void> {
  await db.delete(sailPolar).where(eq(sailPolar.sailId, id));
  await db.delete(sail).where(eq(sail.id, id));
}
