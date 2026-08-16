export function eligibleViaPointMarks<T extends { id: number }>(
  marks: T[],
  leg: { startMarkId: number; endMarkId: number },
): T[] {
  return marks.filter(mark => mark.id !== leg.startMarkId && mark.id !== leg.endMarkId);
}
