import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { sailTwaLimit } from '~/schema';
import { SailTwaLimitInsert } from '../model/sailTwaLimit';

export async function upsertSailTwaLimits(
  sailId: number,
  rows: Omit<SailTwaLimitInsert, 'sailId'>[],
): Promise<void> {
  await db.delete(sailTwaLimit).where(eq(sailTwaLimit.sailId, sailId));

  if (rows.length > 0) {
    await db.insert(sailTwaLimit).values(rows.map(row => ({ ...row, sailId })));
  }
}
