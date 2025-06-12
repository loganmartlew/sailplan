import { db } from '~/lib/db';
import { Course, CourseInsert } from '../model/course';
import { CourseGroup, CourseGroupInsert } from '../model/courseGroup';
import { CourseMark, CourseMarkInsert } from '../model/courseMark';
import { course, courseGroup, courseMark } from '~/schema';

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
  courseMarkInsert: CourseMarkInsert
): Promise<CourseMark> {
  const courseMarks = await db
    .insert(courseMark)
    .values(courseMarkInsert)
    .returning();
  return courseMarks[0];
}
