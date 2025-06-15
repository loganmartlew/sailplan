import { asc, count, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { course, courseGroup } from '~/schema';

interface UseCoursesOptions {
  courseGroupId?: number | null;
}

export function useCourses({ courseGroupId }: UseCoursesOptions = {}) {
  return useLiveQuery(
    db.query.course.findMany({
      ...(courseGroupId && { where: eq(course.courseGroupId, courseGroupId) }),
      ...(courseGroupId === null && { where: isNull(course.courseGroupId) }),
      orderBy: [asc(course.name)],
    })
  );
}

export function useCourse(id: number) {
  return useLiveQuery(
    db.query.course.findFirst({
      where: eq(course.id, id),
      with: {
        courseGroup: true,
      },
    })
  );
}

export function useCourseGroups() {
  return useLiveQuery(
    db
      .select({
        id: courseGroup.id,
        name: courseGroup.name,
        courseCount: count(course.id),
      })
      .from(courseGroup)
      .leftJoin(course, eq(course.courseGroupId, courseGroup.id))
      .groupBy(courseGroup.id)
  );
}
