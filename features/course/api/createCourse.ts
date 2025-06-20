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

    order = maxOrders[0]?.maxOrder ? maxOrders[0].maxOrder + 1 : 0;
  }

  const courseMarks = await db
    .insert(courseMark)
    .values({ ...courseMarkInsert, order })
    .returning();
  return courseMarks[0];
}
