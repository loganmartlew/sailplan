import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { courseMark, courseViaPoint } from '~/schema';

export interface MarkRouteUsage {
  courseMarkCount: number;
  viaPointCount: number;
  /** Distinct Course names using the Mark, so a refusal can name them. */
  courseNames: string[];
}

/**
 * Where a Mark is used across the route tables. The application-side half of
 * ADR-0001 rule 4: `deleteMark` refuses with these names, and
 * `PRAGMA foreign_keys = ON` is the integrity net underneath.
 *
 * Deliberately a leaf module — it imports only the db and schema, so the mark
 * feature can reach it directly without importing the course barrel (which
 * pulls components that import the mark feature back).
 */
export async function getMarkRouteUsage(
  markId: number,
): Promise<MarkRouteUsage> {
  const courseMarks = await db.query.courseMark.findMany({
    where: eq(courseMark.markId, markId),
    with: { course: true },
  });
  const viaPoints = await db.query.courseViaPoint.findMany({
    where: eq(courseViaPoint.markId, markId),
    with: { legStartCourseMark: { with: { course: true } } },
  });

  const courseNames = [
    ...new Set([
      ...courseMarks.map(row => row.course.name),
      ...viaPoints.map(row => row.legStartCourseMark.course.name),
    ]),
  ].sort();

  return {
    courseMarkCount: courseMarks.length,
    viaPointCount: viaPoints.length,
    courseNames,
  };
}
