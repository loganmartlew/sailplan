import { db } from '~/lib/db';
import { course, courseGroup, courseMark, courseViaPoint } from '~/schema';
import { eq, inArray } from 'drizzle-orm';

export async function deleteCourse(id: number): Promise<void> {
  await db.transaction(async tx => {
    const courseMarks = await tx
      .select({ id: courseMark.id })
      .from(courseMark)
      .where(eq(courseMark.courseId, id));

    if (courseMarks.length > 0) {
      await tx
        .delete(courseViaPoint)
        .where(inArray(courseViaPoint.legStartCourseMarkId, courseMarks.map(mark => mark.id)));
    }

    await tx.delete(courseMark).where(eq(courseMark.courseId, id));
    await tx.delete(course).where(eq(course.id, id));
  });
}

export async function deleteCourseGroup(id: number): Promise<void> {
  const courseCount = await db.$count(course, eq(course.courseGroupId, id));
  if (courseCount > 0) {
    throw new Error('Cannot delete course group with existing courses');
  }
  await db.delete(courseGroup).where(eq(courseGroup.id, id));
}
