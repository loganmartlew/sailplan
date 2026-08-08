import { db } from '~/lib/db';
import { Sail, SailInsert } from '../model/sail';
import { sail } from '~/schema';
import { eq } from 'drizzle-orm';

export async function updateSail(
  id: number,
  sailInsert: Partial<SailInsert>
): Promise<Sail> {
  const sails = await db
    .update(sail)
    .set(sailInsert)
    .where(eq(sail.id, id))
    .returning();
  return sails[0];
}
