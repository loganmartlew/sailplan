export function deDupe<T>(array: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  return array.filter(item => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
