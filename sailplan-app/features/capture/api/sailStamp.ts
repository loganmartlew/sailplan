import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { sailStamp } from '~/schema';
import type { SailStamp } from '../model/capture';

export type CaptureStampHistory = {
  id: number;
  sailId: number;
  sailName: string;
  sailColor: string;
  timestamp: number;
};

export async function createSailStamp(
  captureSessionId: number,
  sailId: number,
  timestamp = Date.now(),
): Promise<SailStamp> {
  const rows = await db
    .insert(sailStamp)
    .values({ captureSessionId, sailId, timestamp })
    .returning();
  return rows[0];
}

export async function deleteSailStamp(id: number): Promise<void> {
  await db.delete(sailStamp).where(eq(sailStamp.id, id));
}

export async function getLatestSailStampHistory(
  captureSessionId: number,
): Promise<CaptureStampHistory | null> {
  const latest = await db.query.sailStamp.findFirst({
    where: eq(sailStamp.captureSessionId, captureSessionId),
    orderBy: (row, { desc }) => [desc(row.timestamp), desc(row.id)],
    with: { sail: true },
  });
  return latest
    ? {
        id: latest.id,
        sailId: latest.sailId,
        sailName: latest.sail.name,
        sailColor: latest.sail.color,
        timestamp: latest.timestamp,
      }
    : null;
}
