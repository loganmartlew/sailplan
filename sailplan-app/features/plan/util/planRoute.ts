import { CourseRoute, RoutePoint, RouteSegment } from '~/features/course';
import { MarkInsert } from '~/features/mark';

export interface PlanEndpoint {
  kind: 'planEndpoint';
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * A Plan route is a Course route widened at both ends: the start and finish
 * locations a sailor picks for this plan are not route points of the saved
 * Course, and the Legs joining them to it are synthetic (`legId: null`).
 */
export type PlanRoutePoint = RoutePoint | PlanEndpoint;

export type PlanRouteSegment = Omit<RouteSegment, 'from' | 'to'> & {
  from: PlanRoutePoint;
  to: PlanRoutePoint;
};

export interface PlanRouteLeg {
  legId: number | null;
  index: number;
  start: PlanRoutePoint;
  end: PlanRoutePoint;
  segments: PlanRouteSegment[];
}

export interface PlanRoute {
  courseId: number;
  points: PlanRoutePoint[];
  legs: PlanRouteLeg[];
}

interface BuildPlanRouteInput {
  route: CourseRoute;
  startLocation: MarkInsert | null;
  finishLocation: MarkInsert | null;
}

function toPlanEndpoint(location: MarkInsert): PlanEndpoint {
  return { kind: 'planEndpoint', ...location };
}

/** `index` is assigned once the full Leg sequence is known, so it starts at 0. */
function createSyntheticLeg({
  key,
  from,
  to,
}: {
  key: string;
  from: PlanRoutePoint;
  to: PlanRoutePoint;
}): PlanRouteLeg {
  return {
    legId: null,
    index: 0,
    start: from,
    end: to,
    segments: [{ key, from, to, indexInLeg: 0 }],
  };
}

export function buildPlanRoute({
  route,
  startLocation,
  finishLocation,
}: BuildPlanRouteInput): PlanRoute {
  const start = startLocation ? toPlanEndpoint(startLocation) : null;
  const finish = finishLocation ? toPlanEndpoint(finishLocation) : null;
  const savedLegs: PlanRouteLeg[] = route.legs;
  const firstCoursePoint = route.points[0];
  const lastCoursePoint = route.points.at(-1);
  const legs = [
    ...(start && firstCoursePoint
      ? [createSyntheticLeg({ key: 'plan-start', from: start, to: firstCoursePoint })]
      : []),
    ...savedLegs,
    ...(finish && lastCoursePoint
      ? [createSyntheticLeg({ key: 'plan-finish', from: lastCoursePoint, to: finish })]
      : []),
  ].map((leg, index) => ({ ...leg, index }));

  return {
    courseId: route.courseId,
    points: [...(start ? [start] : []), ...route.points, ...(finish ? [finish] : [])],
    legs,
  };
}
