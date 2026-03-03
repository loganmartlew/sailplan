import { eq } from 'drizzle-orm';
import { hasSailPolars } from '~/features/sailPolar';
import { db } from '~/lib/db';
import { sail, sailPolar } from '~/schema';

export async function deleteSail(id: number): Promise<void> {
  const hasPolars = await hasSailPolars(id);

  if (hasPolars) {
    throw new Error('Cannot delete sail with associated polars');
  }

  await db.delete(sail).where(eq(sail.id, id));
}
