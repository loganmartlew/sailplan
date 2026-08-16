import { db } from '~/lib/db';
import { Course, CourseInsert } from '../model/course';
import { CourseGroup, CourseGroupInsert } from '../model/courseGroup';
import { course, courseGroup } from '~/schema';
import { eq } from 'drizzle-orm';

export async function updateCourse(
  id: number,
  courseInsert: Partial<CourseInsert>
): Promise<Course> {
  const courses = await db
    .update(course)
    .set(courseInsert)
    .where(eq(course.id, id))
    .returning();
  return courses[0];
}

export async function updateCourseGroup(
  id: number,
  courseGroupInsert: Partial<CourseGroupInsert>
): Promise<CourseGroup> {
  const courseGroups = await db
    .update(courseGroup)
    .set(courseGroupInsert)
    .where(eq(courseGroup.id, id))
    .returning();
  return courseGroups[0];
}
