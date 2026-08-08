import { db } from '~/lib/db';
import { SailPolar, SailPolarInsert } from '../model/sailPolar';
import { sailPolar } from '~/schema';

export async function createSailPolar(
  sailPolarInsert: SailPolarInsert,
): Promise<SailPolar> {
  const sailPolars = await db
    .insert(sailPolar)
    .values(sailPolarInsert)
    .returning();
  return sailPolars[0];
}

export async function importSailPolars(
  sailPolars: SailPolarInsert[],
): Promise<SailPolar[]> {
  if (sailPolars.length === 0) {
    return [];
  }

  const insertedPolars = await db
    .insert(sailPolar)
    .values(sailPolars)
    .returning();

  return insertedPolars;
}
