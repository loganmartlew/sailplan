import { asc, count, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { sailPolar } from '~/schema';

export function useSailPolars(sailId: number) {
  return useLiveQuery(
    db.query.sailPolar.findMany({
      where: eq(sailPolar.sailId, sailId),
      orderBy: [asc(sailPolar.twa), asc(sailPolar.tws), asc(sailPolar.speed)],
    }),
  );
}

export async function hasSailPolars(sailId: number): Promise<boolean> {
  const result = await db
    .select({ count: count() })
    .from(sailPolar)
    .where(eq(sailPolar.sailId, sailId));
  return result[0].count > 0;
}
