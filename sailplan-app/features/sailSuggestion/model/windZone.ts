export type WindZone = 'upwind' | 'reaching' | 'downwind';

export function getWindZone(twa: number): WindZone {
  if (twa < 80) return 'upwind';
  if (twa <= 150) return 'reaching';
  return 'downwind';
}
