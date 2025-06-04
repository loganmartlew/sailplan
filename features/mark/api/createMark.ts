import { db } from '~/lib/db';
import { Mark, MarkInsert } from '../model/mark';
import { mark } from '~/schema';
import { eq } from 'drizzle-orm';

export async function createMark(markInsert: MarkInsert): Promise<Mark> {
  const marks = await db.insert(mark).values(markInsert).returning();
  return marks[0];
}

export async function importMarks(marks: MarkInsert[]): Promise<Mark[]> {
  const existingMarks = await db.query.mark.findMany();

  const marksToInsert = marks.filter(
    mark => !existingMarks.some(existingMark => existingMark.name === mark.name)
  );

  if (marksToInsert.length === 0) {
    console.log('No new marks to insert');
    return [];
  }

  const insertedMarks = await db.insert(mark).values(marksToInsert).returning();

  return insertedMarks;
}
