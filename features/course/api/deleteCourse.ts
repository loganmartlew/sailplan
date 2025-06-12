import { db } from '~/lib/db';
import { course, courseGroup, courseMark } from '~/schema';
import { eq } from 'drizzle-orm';

export async function deleteCourse(id: number): Promise<void> {
  await db.delete(courseMark).where(eq(courseMark.courseId, id));
  await db.delete(course).where(eq(course.id, id));
}

export async function deleteCourseGroup(id: number): Promise<void> {
  const courseCount = await db.$count(course, eq(course.courseGroupId, id));
  if (courseCount > 0) {
    throw new Error('Cannot delete course group with existing courses');
  }
  await db.delete(courseGroup).where(eq(courseGroup.id, id));
}

export async function deleteCourseMark(id: number): Promise<void> {
  await db.delete(courseMark).where(eq(courseMark.id, id));
}
