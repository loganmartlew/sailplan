import { CourseRoute, RoutePoint } from '~/features/course';
import { MarkInsert } from '~/features/mark';

export interface PlanEndpoint {
  kind: 'planEndpoint';
  name: string;
  latitude: number;
  longitude: number;
}

export type PlanRoutePoint = RoutePoint | PlanEndpoint;

export interface PlanRouteSegment {
  key: string;
  from: PlanRoutePoint;
  to: PlanRoutePoint;
  indexInLeg: number;
}

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

function createSyntheticLeg({
  key,
  index,
  from,
  to,
}: {
  key: string;
  index: number;
  from: PlanRoutePoint;
  to: PlanRoutePoint;
}): PlanRouteLeg {
  return {
    legId: null,
    index,
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
  const savedLegs: PlanRouteLeg[] = route.legs.map(leg => ({
    legId: leg.legId,
    index: leg.index,
    start: leg.start,
    end: leg.end,
    segments: leg.segments,
  }));
  const firstCoursePoint = route.points[0];
  const lastCoursePoint = route.points.at(-1);
  const legs = [
    ...(start && firstCoursePoint
      ? [createSyntheticLeg({ key: 'plan-start', index: 0, from: start, to: firstCoursePoint })]
      : []),
    ...savedLegs,
    ...(finish && lastCoursePoint
      ? [
          createSyntheticLeg({
            key: 'plan-finish',
            index: savedLegs.length + (start ? 1 : 0),
            from: lastCoursePoint,
            to: finish,
          }),
        ]
      : []),
  ].map((leg, index) => ({ ...leg, index }));

  return {
    courseId: route.courseId,
    points: [...(start ? [start] : []), ...route.points, ...(finish ? [finish] : [])],
    legs,
  };
}
