import { db } from '~/lib/db';
import { Sail, SailInsert } from '../model/sail';
import { sail } from '~/schema';

export async function createSail(sailInsert: SailInsert): Promise<Sail> {
  const sails = await db.insert(sail).values(sailInsert).returning();
  return sails[0];
}
