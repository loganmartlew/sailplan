import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { mark } from '~/schema';

export async function deleteMark(id: number): Promise<void> {
  await db.delete(mark).where(eq(mark.id, id));
}
