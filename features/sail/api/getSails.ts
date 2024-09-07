import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useBoatProfile } from '~/features/boatProfile';
import { db } from '~/lib/db';
import { sail } from '~/schema';

export function useSails() {
  const { boatProfile } = useBoatProfile();

  if (!boatProfile?.id) {
    return null;
  }

  return useLiveQuery(
    db.query.sail.findMany({
      where: eq(sail.boatProfileId, boatProfile.id),
      orderBy: [asc(sail.name)],
    })
  );
}

export async function getSail(id: number) {
  const foundSail = await db.query.sail.findFirst({
    where: eq(sail.id, id),
  });
  return foundSail ?? null;
}

export function useSail(id: number) {
  return useLiveQuery(
    db.query.sail.findFirst({
      where: eq(sail.id, id),
    })
  );
}
