import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { mark } from '~/schema';

export function useMarks() {
  return useLiveQuery(
    db.query.mark.findMany({
      orderBy: [asc(mark.name)],
    })
  );
}

export async function getMark(id: number) {
  const foundMark = await db.query.mark.findFirst({
    where: eq(mark.id, id),
  });
  return foundMark ?? null;
}

export function useMark(id: number) {
  return useLiveQuery(
    db.query.mark.findFirst({
      where: eq(mark.id, id),
    })
  );
}
