import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { sail } from '~/schema';

export async function deleteSail(id: number): Promise<void> {
  //Todo: Delete sail polars
  await db.delete(sail).where(eq(sail.id, id));
}
