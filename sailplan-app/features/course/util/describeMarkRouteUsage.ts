export interface MarkRouteUsageCounts {
  courseMarkCount: number;
  viaPointCount: number;
  courseNames: string[];
}

/**
 * Why a Mark cannot be deleted, naming the Courses that hold it, or `null`
 * when nothing uses it.
 */
export function describeMarkRouteUsage({
  courseMarkCount,
  viaPointCount,
  courseNames,
}: MarkRouteUsageCounts): string | null {
  const usageCount = courseMarkCount + viaPointCount;
  if (usageCount === 0) return null;

  const usages = `${usageCount} ${usageCount === 1 ? 'route point' : 'route points'}`;
  const courses = courseNames.length > 0 ? ` in ${courseNames.join(', ')}` : '';
  return `This Mark is used by ${usages}${courses}. Remove it from ${
    courseNames.length === 1 ? 'that Course' : 'those Courses'
  } before deleting it.`;
}
