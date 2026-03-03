import { db } from '~/lib/db';
import { SailPolar, SailPolarInsert } from '../model/sailPolar';
import { sailPolar } from '~/schema';

export async function createSailPolar(
  sailPolarInsert: SailPolarInsert
): Promise<SailPolar> {
  const sailPolars = await db
    .insert(sailPolar)
    .values(sailPolarInsert)
    .returning();
  return sailPolars[0];
}
