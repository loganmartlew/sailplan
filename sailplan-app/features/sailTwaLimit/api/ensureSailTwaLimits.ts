import { count, eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { sailTwaLimit } from '~/schema';
import { TWS_VALUES } from '../model/sailTwaLimit';

export async function ensureSailTwaLimits(sailId: number): Promise<void> {
  const result = await db
    .select({ count: count() })
    .from(sailTwaLimit)
    .where(eq(sailTwaLimit.sailId, sailId));

  if (result[0].count > 0) {
    return;
  }

  await db.insert(sailTwaLimit).values(
    TWS_VALUES.map(tws => ({
      tws,
      minTwa: null,
      maxTwa: null,
      sailId,
    })),
  );
}
