import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useBoatProfile } from '~/features/boatProfile';
import { db } from '~/lib/db';
import { sail } from '~/schema';

/**
 * `null` until a boat profile is active, as callers expect — but the query runs
 * either way. Returning before `useLiveQuery` made this a conditional hook, so
 * the first render after a profile was chosen called one more hook than the
 * render before it.
 */
export function useSails() {
  const { boatProfile } = useBoatProfile();
  const boatProfileId = boatProfile?.id ?? null;

  const sails = useLiveQuery(
    db.query.sail.findMany({
      // No profile matches -1, so the query returns nothing rather than every
      // boat's sails.
      where: eq(sail.boatProfileId, boatProfileId ?? -1),
      orderBy: [asc(sail.name)],
    }),
    [boatProfileId],
  );

  return boatProfileId === null ? null : sails;
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
    }),
  );
}
