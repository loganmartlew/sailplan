import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { courseMark, courseViaPoint } from '~/schema';

export interface MarkRouteUsage {
  courseMarkCount: number;
  viaPointCount: number;
  /** Distinct Course names using the Mark, so a refusal can name them. */
  courseNames: string[];
  uses: MarkRouteUse[];
}

export interface MarkRouteUse {
  courseId: number;
  courseName: string;
  role: 'courseMark' | 'viaPoint';
  legName?: string;
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
    with: {
      legStartCourseMark: {
        with: {
          mark: true,
          course: { with: { courseMarks: { with: { mark: true } } } },
        },
      },
    },
  });

  const courseNames = [
    ...new Set([
      ...courseMarks.map(row => row.course.name),
      ...viaPoints.map(row => row.legStartCourseMark.course.name),
    ]),
  ].sort();

  const uses: MarkRouteUse[] = [
    ...courseMarks.map(row => ({
      courseId: row.course.id, courseName: row.course.name, role: 'courseMark' as const,
    })),
    ...viaPoints.map(row => {
      const start = row.legStartCourseMark;
      const end = start.course.courseMarks
        .filter(courseMark => courseMark.order > start.order)
        .sort((a, b) => a.order - b.order || a.id - b.id)[0];
      return {
        courseId: start.course.id, courseName: start.course.name, role: 'viaPoint' as const,
        legName: end ? `${start.mark.name} to ${end.mark.name}` : start.mark.name,
      };
    }),
  ].sort((a, b) => a.courseName.localeCompare(b.courseName));

  return {
    courseMarkCount: courseMarks.length,
    viaPointCount: viaPoints.length,
    courseNames,
    uses,
  };
}
