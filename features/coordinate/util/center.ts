import { degreesToRadians, radiansToDegrees } from './bearing';
import { Coordinate } from './types';

/**
 * https://stackoverflow.com/questions/6671183/calculate-the-center-point-of-multiple-latitude-longitude-coordinate-pairs
 * @param coords array of arrays with latitude and longtitude
 *   pairs in degrees. e.g. [[latitude1, longtitude1], [latitude2
 *   [longtitude2] ...]
 *
 * @return array with the center latitude longtitude pairs in
 *   degrees.
 */
export function getLatLngCenter(coords: Coordinate[]): Coordinate {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  coords.forEach(coord => {
    const lat = degreesToRadians(coord.latitude);
    const lng = degreesToRadians(coord.longitude);
    // sum of cartesian coordinates
    sumX += Math.cos(lat) * Math.cos(lng);
    sumY += Math.cos(lat) * Math.sin(lng);
    sumZ += Math.sin(lat);
  });

  const avgX = sumX / coords.length;
  const avgY = sumY / coords.length;
  const avgZ = sumZ / coords.length;

  // convert average x, y, z coordinate to latitude and longtitude
  const lng = Math.atan2(avgY, avgX);
  const hyp = Math.sqrt(avgX * avgX + avgY * avgY);
  const lat = Math.atan2(avgZ, hyp);

  return {
    latitude: radiansToDegrees(lat),
    longitude: radiansToDegrees(lng),
  };
}
