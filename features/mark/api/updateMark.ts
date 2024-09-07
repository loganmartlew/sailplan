import { db } from '~/lib/db';
import { Mark, MarkInsert } from '../model/mark';
import { mark } from '~/schema';
import { eq } from 'drizzle-orm';

export async function updateMark(
  id: number,
  markInsert: Partial<MarkInsert>
): Promise<Mark> {
  const marks = await db
    .update(mark)
    .set(markInsert)
    .where(eq(mark.id, id))
    .returning();
  return marks[0];
}
