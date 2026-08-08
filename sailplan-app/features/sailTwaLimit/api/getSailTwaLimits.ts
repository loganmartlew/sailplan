import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { sailTwaLimit } from '~/schema';

export function useSailTwaLimits(sailId: number) {
  return useLiveQuery(
    db.query.sailTwaLimit.findMany({
      where: eq(sailTwaLimit.sailId, sailId),
      orderBy: [asc(sailTwaLimit.tws)],
    }),
  );
}

export async function getSailTwaLimits(sailId: number) {
  return db.query.sailTwaLimit.findMany({
    where: eq(sailTwaLimit.sailId, sailId),
    orderBy: [asc(sailTwaLimit.tws)],
  });
}
