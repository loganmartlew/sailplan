export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('Cannot take the median of no values');
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export const medianOrNull = (values: readonly number[]) =>
  values.length === 0 ? null : median(values);
