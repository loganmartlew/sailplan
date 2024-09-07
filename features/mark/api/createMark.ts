import { db } from '~/lib/db';
import { Mark, MarkInsert } from '../model/mark';
import { mark } from '~/schema';

export async function createMark(markInsert: MarkInsert): Promise<Mark> {
  const marks = await db.insert(mark).values(markInsert).returning();
  return marks[0];
}
