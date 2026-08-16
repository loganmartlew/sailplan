export function getNextCourseMarkOrder(maxOrder: number | null): number {
  return (maxOrder ?? -1) + 1;
}
