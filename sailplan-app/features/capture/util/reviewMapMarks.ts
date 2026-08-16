export type ReviewMapFocus = 'leg' | 'course';

export interface ReviewMapMark {
  id: number;
  order: number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface ReviewMapCoordinate {
  latitude: number;
  longitude: number;
}

export function selectReviewMapMarks(
  focus: ReviewMapFocus,
  courseMarks: readonly ReviewMapMark[],
  destinationCourseMarkId: number | null,
): readonly ReviewMapMark[] {
  if (focus === 'course') return courseMarks;
  if (destinationCourseMarkId === null || courseMarks.length < 2) return [];
  const destinationIndex = courseMarks.findIndex(mark => mark.id === destinationCourseMarkId);
  if (destinationIndex < 0) return [];
  const fromIndex = (destinationIndex - 1 + courseMarks.length) % courseMarks.length;
  return [courseMarks[fromIndex], courseMarks[destinationIndex]];
}

/**
 * Recorded fixes define what the sailor is reviewing. Planned marks can be
 * stale or from a differently georeferenced course, so they must never expand
 * the camera far enough to make the recorded track disappear.
 */
export function selectReviewMapFrame<T extends ReviewMapCoordinate>(
  trackCoordinates: readonly T[],
  markCoordinates: readonly ReviewMapCoordinate[],
): readonly ReviewMapCoordinate[] {
  return trackCoordinates.length > 0 ? trackCoordinates : markCoordinates;
}
