import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import { db } from '~/lib/db';
import { sail, sailPolar, sailTwaLimit } from '~/schema';
import type { Sail } from '~/features/sail';

type SailPolarRow = {
  sailId: number;
  tws: number;
  twa: number;
  speed: number;
};

type SailLimitRow = SailTwaLimit;

export interface SailSuggestionData {
  sails: Sail[];
  allPolars: Map<number, PolarPoint[]>;
  allLimits: Map<number, SailTwaLimit[]>;
}

function buildSailSuggestionData(
  sails: Sail[],
  polars: SailPolarRow[],
  limits: SailLimitRow[],
): SailSuggestionData {
  const allPolars = new Map<number, PolarPoint[]>();
  const allLimits = new Map<number, SailTwaLimit[]>();

  for (const currentSail of sails) {
    allPolars.set(currentSail.id, []);
    allLimits.set(currentSail.id, []);
  }

  for (const polar of polars) {
    allPolars.get(polar.sailId)?.push({
      tws: polar.tws,
      twa: polar.twa,
      speed: polar.speed,
    });
  }

  for (const limit of limits) {
    allLimits.get(limit.sailId)?.push(limit);
  }

  return { sails, allPolars, allLimits };
}

export function useSailSuggestionData(boatProfileId: number | null) {
  const activeBoatProfileId = boatProfileId ?? -1;

  const sailsQuery = useLiveQuery(
    db.query.sail.findMany({
      where: eq(sail.boatProfileId, activeBoatProfileId),
      orderBy: [asc(sail.name)],
    }),
    [activeBoatProfileId],
  );

  const polarsQuery = useLiveQuery(
    db
      .select({
        sailId: sailPolar.sailId,
        tws: sailPolar.tws,
        twa: sailPolar.twa,
        speed: sailPolar.speed,
      })
      .from(sailPolar)
      .innerJoin(sail, eq(sailPolar.sailId, sail.id))
      .where(eq(sail.boatProfileId, activeBoatProfileId))
      .orderBy(
        asc(sailPolar.sailId),
        asc(sailPolar.twa),
        asc(sailPolar.tws),
        asc(sailPolar.speed),
      ),
    [activeBoatProfileId],
  );

  const limitsQuery = useLiveQuery(
    db
      .select({
        id: sailTwaLimit.id,
        sailId: sailTwaLimit.sailId,
        tws: sailTwaLimit.tws,
        minTwa: sailTwaLimit.minTwa,
        maxTwa: sailTwaLimit.maxTwa,
      })
      .from(sailTwaLimit)
      .innerJoin(sail, eq(sailTwaLimit.sailId, sail.id))
      .where(eq(sail.boatProfileId, activeBoatProfileId))
      .orderBy(asc(sailTwaLimit.sailId), asc(sailTwaLimit.tws)),
    [activeBoatProfileId],
  );

  if (!boatProfileId) {
    return null;
  }

  if (!sailsQuery.data || !polarsQuery.data || !limitsQuery.data) {
    return null;
  }

  return buildSailSuggestionData(
    sailsQuery.data,
    polarsQuery.data,
    limitsQuery.data,
  );
}
