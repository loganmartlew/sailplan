import {
  CourseMarkRoutePoint,
  CourseRoute,
  LocalViaRoutePoint,
  MarkBackedViaRoutePoint,
  RouteLeg,
} from '../model/courseRoute';
import { CourseMarkWithRouteData } from '../model/courseMark';
import { CourseViaPointWithMark } from '../model/courseViaPoint';
import { sortByOrderThenId } from './routeOrder';

export interface CourseRouteRow {
  id: number;
  courseMarks: CourseMarkWithRouteData[];
}

function mapCourseMark(row: CourseMarkWithRouteData): CourseMarkRoutePoint {
  if (!row.mark) {
    throw new Error(`Course Mark ${row.id} has no saved Mark`);
  }

  return {
    kind: 'courseMark',
    courseMarkId: row.id,
    markId: row.markId,
    order: row.order,
    name: row.mark.name,
    latitude: row.mark.latitude,
    longitude: row.mark.longitude,
    direction: row.direction,
    note: row.note,
  };
}

function mapViaPoint(
  row: CourseViaPointWithMark,
): LocalViaRoutePoint | MarkBackedViaRoutePoint {
  if (
    row.markId !== null &&
    row.name === null &&
    row.latitude === null &&
    row.longitude === null &&
    row.mark !== null
  ) {
    return {
      kind: 'markBackedVia',
      viaPointId: row.id,
      markId: row.markId,
      name: row.mark.name,
      latitude: row.mark.latitude,
      longitude: row.mark.longitude,
      note: row.note,
    };
  }

  if (
    row.markId === null &&
    row.name !== null &&
    row.latitude !== null &&
    row.longitude !== null &&
    row.mark === null
  ) {
    return {
      kind: 'localVia',
      viaPointId: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      note: row.note,
    };
  }

  throw new Error(`Via Point ${row.id} must be either local or Mark-backed`);
}

export function mapCourseRoute(row: CourseRouteRow): CourseRoute {
  const courseMarkRows = sortByOrderThenId(row.courseMarks);
  const courseMarks = courseMarkRows.map(mapCourseMark);
  const viaPointsByCourseMark = new Map(
    courseMarkRows.map(courseMarkRow => [
      courseMarkRow.id,
      sortByOrderThenId(courseMarkRow.viaPoints).map(mapViaPoint),
    ]),
  );

  const legs: RouteLeg[] = courseMarks.slice(0, -1).map((start, index) => {
    const end = courseMarks[index + 1];
    const viaPoints = viaPointsByCourseMark.get(start.courseMarkId) ?? [];
    const legPoints = [start, ...viaPoints, end];

    return {
      legId: start.courseMarkId,
      index,
      start,
      end,
      viaPoints,
      segments: legPoints.slice(0, -1).map((from, indexInLeg) => ({
        key: `${start.courseMarkId}:${indexInLeg}`,
        from,
        to: legPoints[indexInLeg + 1],
        indexInLeg,
      })),
    };
  });

  const terminalCourseMark = courseMarkRows.at(-1);
  if (terminalCourseMark && terminalCourseMark.viaPoints.length > 0) {
    throw new Error(
      `Course Mark ${terminalCourseMark.id} cannot own Via Points because it does not start a Leg`,
    );
  }

  return {
    courseId: row.id,
    points: courseMarks.length === 0
      ? []
      : [courseMarks[0], ...legs.flatMap(leg => [...leg.viaPoints, leg.end])],
    legs,
  };
}
