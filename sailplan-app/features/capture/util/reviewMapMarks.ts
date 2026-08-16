export type ReviewMapFocus = 'leg' | 'course';

export interface ReviewMapMark {
  id: number;
  order: number;
  name: string;
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
