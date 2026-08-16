import { CourseMarkWithMark } from '../model/courseMark';
import { CourseRoute } from '../model/courseRoute';

/**
 * The Course Marks of a route as row-shaped values, for the list UI and the
 * pieces that still speak `CourseMarkWithMark`. Each row keeps its *persisted*
 * `order` — the position within `route.points` counts Via Points too, so the
 * two diverge as soon as a Leg holds any.
 */
export function toCourseMarkRows(route: CourseRoute): CourseMarkWithMark[] {
  return route.points.flatMap(point =>
    point.kind === 'courseMark'
      ? [
          {
            id: point.courseMarkId,
            courseId: route.courseId,
            markId: point.markId,
            order: point.order,
            direction: point.direction,
            note: point.note,
            mark: {
              id: point.markId,
              name: point.name,
              latitude: point.latitude,
              longitude: point.longitude,
            },
          },
        ]
      : [],
  );
}
