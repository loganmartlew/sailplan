export function formatCaptureDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const clock = [minutes, seconds]
    .map(value => value.toString().padStart(2, '0'))
    .join(':');

  return hours > 0 ? `${hours}:${clock}` : clock;
}
