import { asc, count, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { course, courseGroup, courseMark } from '~/schema';

interface UseCoursesOptions {
  courseGroupId?: number | null;
}

export function useCourses({ courseGroupId }: UseCoursesOptions = {}) {
  return useLiveQuery(
    db.query.course.findMany({
      ...(courseGroupId && { where: eq(course.courseGroupId, courseGroupId) }),
      ...(courseGroupId === null && { where: isNull(course.courseGroupId) }),
      orderBy: [asc(course.name)],
    }),
    [courseGroupId]
  );
}

export function getCourses({ courseGroupId }: UseCoursesOptions = {}) {
  return db.query.course.findMany({
    ...(courseGroupId && { where: eq(course.courseGroupId, courseGroupId) }),
    ...(courseGroupId === null && { where: isNull(course.courseGroupId) }),
    orderBy: [asc(course.name)],
  });
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
    db.query.courseGroup.findMany({
      orderBy: [asc(courseGroup.name)],
      with: {
        courses: true,
      },
    }),
    [courseGroup, course]
  );
}

export function useCourseGroup(id: number) {
  return useLiveQuery(
    db.query.courseGroup.findFirst({
      where: eq(courseGroup.id, id),
    })
  );
}

export function useCourseMarks(courseId?: number | null) {
  return useLiveQuery(
    db.query.courseMark.findMany({
      where: eq(courseMark.courseId, courseId ?? -1),
      // `(order, id)` — see the note in `captureReview.ts`.
      orderBy: [asc(courseMark.order), asc(courseMark.id)],
      with: {
        mark: true,
      },
    }),
    [courseId]
  );
}
