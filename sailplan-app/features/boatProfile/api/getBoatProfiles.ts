import { db } from '~/lib/db';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { asc, eq } from 'drizzle-orm';
import { boatProfile } from '~/schema';

export async function getBoatProfile(id: number) {
  const profile = await db.query.boatProfile.findFirst({
    where: eq(boatProfile.id, id),
  });
  return profile ?? null;
}

export function useBoatProfiles() {
  return useLiveQuery(
    db.query.boatProfile.findMany({
      orderBy: [asc(boatProfile.name)],
    })
  );
}
