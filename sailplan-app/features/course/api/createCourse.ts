import { db } from '~/lib/db';
import { Course, CourseInsert } from '../model/course';
import { CourseGroup, CourseGroupInsert } from '../model/courseGroup';
import { CourseMark, CourseMarkInsert } from '../model/courseMark';
import { course, courseGroup, courseMark } from '~/schema';
import { eq, max } from 'drizzle-orm';

export async function createCourse(
  courseInsert: CourseInsert
): Promise<Course> {
  const courses = await db.insert(course).values(courseInsert).returning();
  return courses[0];
}

export async function createCourseGroup(
  courseGroupInsert: CourseGroupInsert
): Promise<CourseGroup> {
  const courseGroups = await db
    .insert(courseGroup)
    .values(courseGroupInsert)
    .returning();
  return courseGroups[0];
}

export async function createCourseMark(
  courseMarkInsert: Omit<CourseMarkInsert, 'order'> & { order?: number }
): Promise<CourseMark> {
  let order = courseMarkInsert.order;

  if (order === undefined || order === null) {
    const maxOrders = await db
      .select({ maxOrder: max(courseMark.order) })
      .from(courseMark)
      .where(eq(courseMark.courseId, courseMarkInsert.courseId));

    // `?? -1`, not a falsy check: an existing max order of 0 is a real order,
    // and treating it as absent gave every mark after the first the order 0 —
    // which left mark sequence to SQLite's tiebreak on every course built here.
    order = (maxOrders[0]?.maxOrder ?? -1) + 1;
  }

  const courseMarks = await db
    .insert(courseMark)
    .values({ ...courseMarkInsert, order })
    .returning();
  return courseMarks[0];
}
