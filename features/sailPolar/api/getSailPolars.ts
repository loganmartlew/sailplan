import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { sailPolar } from '~/schema';

export function useSailPolars(sailId: number) {
  return useLiveQuery(
    db.query.sailPolar.findMany({
      where: eq(sailPolar.sailId, sailId),
      orderBy: [asc(sailPolar.twa), asc(sailPolar.tws), asc(sailPolar.speed)],
    })
  );
}
