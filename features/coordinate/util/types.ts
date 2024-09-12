import { z } from 'zod';

export const CoordFormat = z.enum(['DMS', 'DMM']); // Degrees Minutes Seconds, Degrees Decimal Minutes
export const CompassDirection = z.enum(['N', 'S', 'E', 'W']);

export type CompassDirection = z.infer<typeof CompassDirection>;

export type Cardinality = -1 | 1;

export interface Coordinate {
  latitude: number;
  longitude: number;
}
