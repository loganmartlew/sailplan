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
