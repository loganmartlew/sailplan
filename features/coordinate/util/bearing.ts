import { Coordinate, TWA } from './types';

export const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;
export const radiansToDegrees = (degrees: number) => (degrees * 180) / Math.PI;

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

export function getTwa(twd: number, bearing: number): TWA {
  // Normalize the angles to be between 0 and 360 degrees
  const normalizedTWD = ((twd % 360) + 360) % 360;
  const normalizedBearing = ((bearing % 360) + 360) % 360;

  // Calculate the difference between TWD and bearing
  let angle = normalizedTWD - normalizedBearing;

  // Normalize the angle to the range of -180 to 180
  if (angle > 180) {
    angle -= 360;
  } else if (angle < -180) {
    angle += 360;
  }

  // Calculate absolute angle
  const trueWindAngle = Math.abs(angle);

  // Determine the tack
  const tack: TWA['tack'] = angle > 0 ? 'starboard' : 'port';

  return {
    angle: trueWindAngle,
    tack: trueWindAngle === 0 || trueWindAngle === 180 ? null : tack,
  };
}
