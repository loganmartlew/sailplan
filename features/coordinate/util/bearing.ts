import { Coordinate } from './types';

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function coordsToBearing(from: Coordinate, to: Coordinate): number {
  const φ1 = degreesToRadians(from.latitude);
  const φ2 = degreesToRadians(to.latitude);
  const λ1 = degreesToRadians(from.longitude);
  const λ2 = degreesToRadians(to.longitude);

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);
  const brng = ((θ * 180) / Math.PI + 360) % 360; // in degrees

  return brng;
}
