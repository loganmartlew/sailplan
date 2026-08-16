import { useMemo } from 'react';
import { asc, eq, inArray, max } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { course, courseMark, courseViaPoint } from '~/schema';
import { CourseMark, CourseMarkInsert } from '../model/courseMark';
import { CourseRoute } from '../model/courseRoute';
import { getNextCourseMarkOrder } from '../util/courseMarkOrder';
import { mapCourseRoute } from '../util/mapCourseRoute';
import {
  CourseMarkDeletionPlan,
  planCourseMarkDeletion,
} from '../util/planCourseMarkDeletion';
import { planCourseMarkReorder } from '../util/planCourseMarkReorder';
import { normaliseRoutePointNote } from '../util/routePointNote';

type CreateCourseMarkValues = Omit<CourseMarkInsert, 'id' | 'order'>;
type UpdateCourseMarkValues = Partial<
  Pick<CourseMarkInsert, 'markId' | 'direction' | 'note'>
>;
export interface RouteEditResult<T> { value: T; undo: () => Promise<void> }

/** Reads sort `order, id` so ties degrade to insertion order (ADR-0001 rule 1). */
const courseMarkOrderBy = [asc(courseMark.order), asc(courseMark.id)];
const viaPointOrderBy = [asc(courseViaPoint.order), asc(courseViaPoint.id)];

export function useCourseRoute(courseId?: number | null): {
  data: CourseRoute | undefined;
  error: Error | undefined;
  updatedAt: Date | undefined;
} {
  const { data, error, updatedAt } = useLiveQuery(
    db.query.course.findFirst({
      where: eq(course.id, courseId ?? -1),
      with: {
        courseMarks: {
          orderBy: courseMarkOrderBy,
          with: {
            mark: true,
            viaPoints: { orderBy: viaPointOrderBy, with: { mark: true } },
          },
        },
      },
    }),
    [courseId],
  );

  // The mapper rejects malformed rows by throwing; surfacing that as the
  // query's error keeps a broken Course a deliberate state rather than a
  // crash mid-render.
  const mapped = useMemo(() => {
    if (!data) return { route: undefined, mappingError: undefined };
    try {
      return { route: mapCourseRoute(data), mappingError: undefined };
    } catch (mappingError) {
      return { route: undefined, mappingError: mappingError as Error };
    }
  }, [data]);

  return {
    data: mapped.route,
    error: error ?? mapped.mappingError,
    updatedAt,
  };
}

/**
 * The Course-Mark-only read, kept for the Course list count, the Course Mark
 * summary, and the start/finish location picker — the callers that need marks
 * without Legs, Segments, or Via Points.
 */
export function useCourseMarks(courseId?: number | null) {
  return useLiveQuery(
    db.query.courseMark.findMany({
      where: eq(courseMark.courseId, courseId ?? -1),
      orderBy: courseMarkOrderBy,
      with: { mark: true },
    }),
    [courseId],
  );
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

export async function insertMarkBackedViaPoint({
  legStartCourseMarkId,
  markId,
  order,
  note,
}: {
  legStartCourseMarkId: number;
  markId: number;
  order: number;
  note?: string | null;
}): Promise<RouteEditResult<number>> {
  const id = await db.transaction(async tx => {
    const rows = await tx.query.courseViaPoint.findMany({
      where: eq(courseViaPoint.legStartCourseMarkId, legStartCourseMarkId),
      orderBy: viaPointOrderBy,
    });
    const insertionOrder = Math.max(0, Math.min(order, rows.length));
    for (const row of rows.filter(row => row.order >= insertionOrder).reverse()) {
      await tx.update(courseViaPoint).set({ order: row.order + 1 }).where(eq(courseViaPoint.id, row.id));
    }
    const inserted = await tx.insert(courseViaPoint).values({
      legStartCourseMarkId, order: insertionOrder, markId,
      name: null, latitude: null, longitude: null,
      note: normaliseRoutePointNote(note),
    }).returning({ id: courseViaPoint.id });
    return inserted[0].id;
  });
  return { value: id, undo: async () => { await removeViaPoint(id); } };
}

export async function updateMarkBackedViaPoint(
  id: number,
  values: { markId?: number; note?: string | null },
): Promise<RouteEditResult<void>> {
  const previous = await db.transaction(async tx => {
    const row = await tx.query.courseViaPoint.findFirst({ where: eq(courseViaPoint.id, id) });
    if (!row || row.markId === null) return null;
    const next = { ...values, ...('note' in values ? { note: normaliseRoutePointNote(values.note) } : {}) };
    await tx.update(courseViaPoint).set(next).where(eq(courseViaPoint.id, id));
    return row;
  });
  if (!previous) throw new Error('Mark-backed Via Point not found');
  return {
    value: undefined,
    undo: async () => {
      await db.transaction(async tx => {
        await tx.update(courseViaPoint).set({ markId: previous.markId, note: previous.note }).where(eq(courseViaPoint.id, id));
      });
    },
  };
}

export async function removeViaPoint(id: number): Promise<RouteEditResult<void>> {
  const previous = await db.transaction(async tx => {
    const row = await tx.query.courseViaPoint.findFirst({ where: eq(courseViaPoint.id, id) });
    if (!row) return null;
    await tx.delete(courseViaPoint).where(eq(courseViaPoint.id, id));
    const remaining = await tx.query.courseViaPoint.findMany({
      where: eq(courseViaPoint.legStartCourseMarkId, row.legStartCourseMarkId), orderBy: viaPointOrderBy,
    });
    for (const [order, row] of remaining.entries()) {
      if (row.order !== order) await tx.update(courseViaPoint).set({ order }).where(eq(courseViaPoint.id, row.id));
    }
    return row;
  });
  if (!previous) return { value: undefined, undo: async () => undefined };
  return {
    value: undefined,
    undo: async () => {
      await db.transaction(async tx => {
        const rows = await tx.query.courseViaPoint.findMany({ where: eq(courseViaPoint.legStartCourseMarkId, previous.legStartCourseMarkId), orderBy: viaPointOrderBy });
        for (const row of rows.filter(row => row.order >= previous.order).reverse()) {
          await tx.update(courseViaPoint).set({ order: row.order + 1 }).where(eq(courseViaPoint.id, row.id));
        }
        await tx.insert(courseViaPoint).values(previous);
      });
    },
  };
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
      orderBy: courseMarkOrderBy,
      with: { viaPoints: true },
    });

    const plan = planCourseMarkReorder({
      courseMarks: courseMarks.map(row => ({
        id: row.id,
        viaPointCount: row.viaPoints.length,
      })),
      from,
      to,
    });

    if (plan.kind === 'noop') return;
    if (plan.kind === 'blocked') {
      throw new Error(
        'Cannot reorder Course Marks while an affected Leg holds Via Points',
      );
    }

    for (const [order, id] of plan.orderedCourseMarkIds.entries()) {
      await tx.update(courseMark).set({ order }).where(eq(courseMark.id, id));
    }
  });
}

/**
 * How many Via Points deleting this Course Mark would destroy — the count the
 * caller's confirmation names before committing (ADR-0001 rule 3).
 */
export async function countViaPointsDestroyedByDeletion(
  id: number,
): Promise<number> {
  const plan = await db.transaction(tx => planDeletion(tx, id));
  return plan.kind === 'delete' ? plan.deletedViaPointIds.length : 0;
}

export async function deleteCourseMark(id: number): Promise<void> {
  await db.transaction(async tx => {
    const plan = await planDeletion(tx, id);
    if (plan.kind === 'notFound') return;

    for (const reparented of plan.reparentedViaPoints) {
      await tx
        .update(courseViaPoint)
        .set({
          legStartCourseMarkId: reparented.legStartCourseMarkId,
          order: reparented.order,
        })
        .where(eq(courseViaPoint.id, reparented.viaPointId));
    }

    if (plan.deletedViaPointIds.length > 0) {
      await tx
        .delete(courseViaPoint)
        .where(inArray(courseViaPoint.id, plan.deletedViaPointIds));
    }

    await tx.delete(courseMark).where(eq(courseMark.id, plan.courseMarkId));
  });
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function planDeletion(
  tx: Transaction,
  id: number,
): Promise<CourseMarkDeletionPlan> {
  const target = await tx.query.courseMark.findFirst({
    where: eq(courseMark.id, id),
  });
  if (!target) return { kind: 'notFound' };

  const courseMarks = await tx.query.courseMark.findMany({
    where: eq(courseMark.courseId, target.courseId),
    orderBy: courseMarkOrderBy,
    with: { viaPoints: { orderBy: viaPointOrderBy } },
  });

  return planCourseMarkDeletion({
    courseMarks: courseMarks.map(row => ({
      id: row.id,
      viaPointIds: row.viaPoints.map(viaPoint => viaPoint.id),
    })),
    courseMarkId: id,
  });
}
