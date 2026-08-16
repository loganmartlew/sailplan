/** A Course Mark as the deletion planner needs it: identity plus its Leg's Via Points, in order. */
export interface DeletableCourseMark {
  id: number;
  viaPointIds: number[];
}

export interface ViaPointReparent {
  viaPointId: number;
  legStartCourseMarkId: number;
  order: number;
}

export type CourseMarkDeletionPlan =
  | { kind: 'notFound' }
  | {
      kind: 'delete';
      courseMarkId: number;
      /** Via Points that survive, moved onto the merged Leg. */
      reparentedViaPoints: ViaPointReparent[];
      /** Via Points with nowhere to merge — the count a confirmation must name. */
      deletedViaPointIds: number[];
    };

/**
 * Deleting an interior Course Mark merges its two adjacent Legs and
 * concatenates their Via Points in order. Deleting the first or last Course
 * Mark destroys a Leg with nowhere to merge, so its Via Points go with it
 * (ADR-0001 rule 3) — the caller confirms that loss by naming
 * `deletedViaPointIds.length` before committing.
 */
export function planCourseMarkDeletion({
  courseMarks,
  courseMarkId,
}: {
  courseMarks: readonly DeletableCourseMark[];
  courseMarkId: number;
}): CourseMarkDeletionPlan {
  const targetIndex = courseMarks.findIndex(
    courseMark => courseMark.id === courseMarkId,
  );
  if (targetIndex === -1) return { kind: 'notFound' };

  const target = courseMarks[targetIndex];
  const previous = courseMarks[targetIndex - 1];
  const isTerminal = targetIndex === courseMarks.length - 1;

  if (previous && !isTerminal) {
    return {
      kind: 'delete',
      courseMarkId,
      reparentedViaPoints: target.viaPointIds.map((viaPointId, index) => ({
        viaPointId,
        legStartCourseMarkId: previous.id,
        order: previous.viaPointIds.length + index,
      })),
      deletedViaPointIds: [],
    };
  }

  return {
    kind: 'delete',
    courseMarkId,
    reparentedViaPoints: [],
    deletedViaPointIds: [
      ...target.viaPointIds,
      // The previous Course Mark becomes terminal, so its Leg goes too.
      ...(previous && isTerminal ? previous.viaPointIds : []),
    ],
  };
}
