import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useBoatProfile } from '~/features/boatProfile';
import { db } from '~/lib/db';
import { mark } from '~/schema';

export function useMarks() {
  const { boatProfile } = useBoatProfile();

  if (!boatProfile?.id) {
    return null;
  }

  return useLiveQuery(
    db.query.mark.findMany({
      where: eq(mark.boatProfileId, boatProfile.id),
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
