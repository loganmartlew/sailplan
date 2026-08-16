import { coordsToBearing, getTwa } from '~/features/coordinate/util/bearing';
import { TWA } from '~/features/coordinate/util/types';
import { PlanRouteSegment } from './planRoute';

export interface SegmentGuidance {
  bearing: number;
  twa: TWA;
}

export function calculateSegmentGuidance(
  segment: PlanRouteSegment,
  twd: number,
): SegmentGuidance {
  const bearing = coordsToBearing({ from: segment.from, to: segment.to });
  return { bearing, twa: getTwa({ bearing, twd }) };
}
