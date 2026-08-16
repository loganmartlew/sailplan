import { asc, eq, inArray, max } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { course, courseMark, courseViaPoint } from '~/schema';
import { CourseMark, CourseMarkInsert } from '../model/courseMark';
import { CourseRoute } from '../model/courseRoute';
import { getNextCourseMarkOrder } from '../util/courseMarkOrder';
import { mapCourseRoute } from '../util/mapCourseRoute';

type CreateCourseMarkValues = Omit<CourseMarkInsert, 'id' | 'order'>;
type UpdateCourseMarkValues = Partial<
  Pick<CourseMarkInsert, 'markId' | 'direction' | 'note'>
>;

export function useCourseRoute(courseId?: number | null) {
  const query = useLiveQuery(
    db.query.course.findFirst({
      where: eq(course.id, courseId ?? -1),
      with: {
        courseMarks: {
          orderBy: [asc(courseMark.order), asc(courseMark.id)],
          with: {
            mark: true,
            viaPoints: {
              orderBy: [asc(courseViaPoint.order), asc(courseViaPoint.id)],
              with: { mark: true },
            },
          },
        },
      },
    }),
    [courseId],
  );

  return {
    ...query,
    data: query.data ? mapCourseRoute(query.data) : undefined,
  } as Omit<typeof query, 'data'> & { data: CourseRoute | undefined };
}

export async function createCourseMark(
  values: CreateCourseMarkValues,
): Promise<CourseMark> {
  return db.transaction(async tx => {
    const result = await tx
      .select({ maxOrder: max(courseMark.order) })
      .from(courseMark)
      .where(eq(courseMark.courseId, values.courseId));
    const order = getNextCourseMarkOrder(result[0]?.maxOrder ?? null);

    const courseMarks = await tx
      .insert(courseMark)
      .values({ ...values, order })
      .returning();
    return courseMarks[0];
  });
}

export async function updateCourseMark(
  id: number,
  values: UpdateCourseMarkValues,
): Promise<CourseMark> {
  return db.transaction(async tx => {
    const courseMarks = await tx
      .update(courseMark)
      .set(values)
      .where(eq(courseMark.id, id))
      .returning();
    return courseMarks[0];
  });
}

export async function reorderCourseMarks({
  courseId,
  from,
  to,
}: {
  courseId: number;
  from: number;
  to: number;
}): Promise<void> {
  await db.transaction(async tx => {
    const courseMarks = await tx.query.courseMark.findMany({
      where: eq(courseMark.courseId, courseId),
      orderBy: [asc(courseMark.order), asc(courseMark.id)],
      with: { viaPoints: true },
    });

    if (courseMarks.some(courseMark => courseMark.viaPoints.length > 0)) {
      throw new Error('Cannot reorder Course Marks while the Course has Via Points');
    }

    const moved = courseMarks[from];
    if (!moved || to < 0 || to >= courseMarks.length) return;

    const reordered = courseMarks.filter((_, index) => index !== from);
    reordered.splice(to, 0, moved);

    for (const [order, courseMarkToUpdate] of reordered.entries()) {
      await tx
        .update(courseMark)
        .set({ order })
        .where(eq(courseMark.id, courseMarkToUpdate.id));
    }
  });
}

export async function deleteCourseMark(id: number): Promise<void> {
  await db.transaction(async tx => {
    const target = await tx.query.courseMark.findFirst({
      where: eq(courseMark.id, id),
    });
    if (!target) return;

    const courseMarks = await tx.query.courseMark.findMany({
      where: eq(courseMark.courseId, target.courseId),
      orderBy: [asc(courseMark.order), asc(courseMark.id)],
      with: {
        viaPoints: {
          orderBy: [asc(courseViaPoint.order), asc(courseViaPoint.id)],
        },
      },
    });
    const targetIndex = courseMarks.findIndex(courseMark => courseMark.id === id);
    const previous = courseMarks[targetIndex - 1];
    const targetWithViaPoints = courseMarks[targetIndex];

    if (previous && targetIndex < courseMarks.length - 1) {
      for (const [index, viaPoint] of targetWithViaPoints.viaPoints.entries()) {
        await tx
          .update(courseViaPoint)
          .set({
            legStartCourseMarkId: previous.id,
            order: previous.viaPoints.length + index,
          })
          .where(eq(courseViaPoint.id, viaPoint.id));
      }
    } else {
      const viaPointIds = [
        ...targetWithViaPoints.viaPoints,
        ...(previous && targetIndex === courseMarks.length - 1
          ? previous.viaPoints
          : []),
      ].map(viaPoint => viaPoint.id);
      if (viaPointIds.length > 0) {
        await tx
          .delete(courseViaPoint)
          .where(inArray(courseViaPoint.id, viaPointIds));
      }
    }

    await tx.delete(courseMark).where(eq(courseMark.id, id));
  });
}
