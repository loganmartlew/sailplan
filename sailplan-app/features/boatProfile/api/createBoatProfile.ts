import { db } from '~/lib/db';
import { BoatProfile, BoatProfileInsert } from '../model/boatProfile';
import { boatProfile } from '~/schema';

export async function createBoatProfile(
  boatProfileInsert: BoatProfileInsert
): Promise<BoatProfile> {
  const profiles = await db
    .insert(boatProfile)
    .values(boatProfileInsert)
    .returning();

  return profiles[0];
}
