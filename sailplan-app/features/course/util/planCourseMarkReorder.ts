/**
 * A Course Mark as the reorder planner needs it: its identity and how many Via
 * Points the Leg it starts holds.
 */
export interface ReorderableCourseMark {
  id: number;
  viaPointCount: number;
}

export type CourseMarkReorderPlan =
  | { kind: 'noop' }
  | { kind: 'blocked'; blockedLegStartCourseMarkIds: number[] }
  | { kind: 'reorder'; orderedCourseMarkIds: number[] };

/**
 * A Leg is identified by its start Course Mark, so a Leg is *affected* by a
 * reorder when the Course Mark that ends it changes — including a Leg that
 * stops existing because its start moves to the end of the Course. Reorder is
 * blocked only while an affected Leg holds Via Points (ADR-0001 rule 3); moving
 * marks elsewhere in the Course leaves those Legs intact and is allowed.
 */
export function planCourseMarkReorder({
  courseMarks,
  from,
  to,
}: {
  courseMarks: readonly ReorderableCourseMark[];
  from: number;
  to: number;
}): CourseMarkReorderPlan {
  const moved = courseMarks[from];
  if (!moved || to < 0 || to >= courseMarks.length || from === to) {
    return { kind: 'noop' };
  }

  const reordered = courseMarks.filter((_, index) => index !== from);
  reordered.splice(to, 0, moved);

  const blockedLegStartCourseMarkIds = courseMarks
    .filter(
      (courseMark, index) =>
        courseMark.viaPointCount > 0 &&
        legEndId(courseMarks, index) !==
          legEndId(reordered, reordered.indexOf(courseMark)),
    )
    .map(courseMark => courseMark.id);

  if (blockedLegStartCourseMarkIds.length > 0) {
    return { kind: 'blocked', blockedLegStartCourseMarkIds };
  }

  return {
    kind: 'reorder',
    orderedCourseMarkIds: reordered.map(courseMark => courseMark.id),
  };
}

function legEndId(
  courseMarks: readonly ReorderableCourseMark[],
  index: number,
): number | null {
  return courseMarks[index + 1]?.id ?? null;
}
