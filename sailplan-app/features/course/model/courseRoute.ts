export interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

export interface CourseMarkRoutePoint extends RouteCoordinates {
  kind: 'courseMark';
  courseMarkId: number;
  markId: number;
  name: string;
  direction: 'port' | 'starboard' | null;
  note: string | null;
}

export interface LocalViaRoutePoint extends RouteCoordinates {
  kind: 'localVia';
  viaPointId: number;
  name: string;
  note: string | null;
}

export interface MarkBackedViaRoutePoint extends RouteCoordinates {
  kind: 'markBackedVia';
  viaPointId: number;
  markId: number;
  name: string;
  note: string | null;
}

export type RoutePoint =
  | CourseMarkRoutePoint
  | LocalViaRoutePoint
  | MarkBackedViaRoutePoint;

export interface RouteSegment {
  key: string;
  from: RoutePoint;
  to: RoutePoint;
  indexInLeg: number;
}

export interface RouteLeg {
  legId: number;
  index: number;
  start: CourseMarkRoutePoint;
  end: CourseMarkRoutePoint;
  viaPoints: Array<LocalViaRoutePoint | MarkBackedViaRoutePoint>;
  segments: RouteSegment[];
}

export interface CourseRoute {
  courseId: number;
  points: RoutePoint[];
  legs: RouteLeg[];
}
