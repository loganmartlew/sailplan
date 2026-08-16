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

const MARK_FRAME_DISTANCE_METRES = 2_000;
const EARTH_RADIUS_METRES = 6_371_000;

function distanceMetres(a: ReviewMapCoordinate, b: ReviewMapCoordinate): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const aLatitude = toRadians(a.latitude);
  const bLatitude = toRadians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(aLatitude) * Math.cos(bLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(haversine));
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
  if (trackCoordinates.length === 0) return markCoordinates;
  const nearbyMarks = markCoordinates.filter(mark =>
    trackCoordinates.some(point => distanceMetres(point, mark) <= MARK_FRAME_DISTANCE_METRES),
  );
  return [...trackCoordinates, ...nearbyMarks];
}
