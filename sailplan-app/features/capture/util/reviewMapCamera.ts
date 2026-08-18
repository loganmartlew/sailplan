/**
 * Camera rules for the review map, kept out of the component so they can be
 * tested without a `MapView`.
 *
 * Two things are being protected. The first is the sailor's zoom: the map used
 * to re-frame from a `useEffect` on the framed coordinates, so every divider
 * moved in the span editor yanked the camera back out. The second is
 * continuity across the expand animation, where the map is resized and a naive
 * re-frame would throw the track away exactly when the sailor is watching it.
 */

export type ReviewMapCameraEvent =
  /** The map got, or changed, its size. */
  | 'layout'
  /** The framed coordinates changed — a span edit, or the first fix arriving. */
  | 'trackChange'
  /** The sailor switched leg ⟷ whole course. */
  | 'focusChange'
  /** The sailor asked for the frame back. */
  | 'recenter'
  /** The sailor moved the camera themselves. */
  | 'gesture';

export interface ReviewMapCameraState {
  /**
   * Whether the track has been framed once. Everything that is not an explicit
   * request for the frame fits only while this is false, which is what makes
   * the sailor's zoom survive both span edits and the expand resize.
   */
  readonly framed: boolean;
}

export interface ReviewMapCameraStep {
  readonly state: ReviewMapCameraState;
  readonly fit: boolean;
}

export const initialReviewMapCamera: ReviewMapCameraState = { framed: false };

export function stepReviewMapCamera(
  state: ReviewMapCameraState,
  event: ReviewMapCameraEvent,
  hasCoordinates: boolean,
): ReviewMapCameraStep {
  // Nothing to frame yet. Staying unframed is what lets the first fix to
  // arrive fit, however late it is.
  if (!hasCoordinates) return { state: initialReviewMapCamera, fit: false };

  switch (event) {
    case 'focusChange':
    case 'recenter':
      return { state: { framed: true }, fit: true };
    case 'gesture':
      return { state: { framed: true }, fit: false };
    case 'layout':
    case 'trackChange':
      return { state: { framed: true }, fit: !state.framed };
  }
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

const MAX_LATITUDE_DELTA = 180;
const MAX_LONGITUDE_DELTA = 360;

/**
 * The same view of the world, in a differently sized frame. Holding the centre
 * and scaling each delta by its own dimension's growth leaves degrees-per-pixel
 * unchanged on both axes, so the track sits still while the frame grows around
 * it and the extra room simply reveals more water.
 */
export function rescaleRegion(
  region: MapRegion,
  from: FrameSize,
  to: FrameSize,
): MapRegion {
  if (from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) {
    return region;
  }
  return {
    latitude: region.latitude,
    longitude: region.longitude,
    latitudeDelta: Math.min(
      region.latitudeDelta * (to.height / from.height),
      MAX_LATITUDE_DELTA,
    ),
    longitudeDelta: Math.min(
      region.longitudeDelta * (to.width / from.width),
      MAX_LONGITUDE_DELTA,
    ),
  };
}

export interface EdgePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** What a single fix is given, having no span of its own to be framed by. */
const POINT_REGION_DELTA = 0.01;

/**
 * The region `fitToCoordinates` would settle on for this frame, computed here
 * so the fullscreen map can open on the inline map's view even when the inline
 * map has not yet reported a region of its own — a fast press after mount would
 * otherwise open on a fresh fit, which is the one jump the expand animation
 * exists to avoid.
 */
export function regionForCoordinates(
  coordinates: readonly Coordinate[],
  frame: FrameSize,
  padding: EdgePadding,
): MapRegion | null {
  if (coordinates.length === 0 || frame.width <= 0 || frame.height <= 0) return null;

  const latitudes = coordinates.map(point => point.latitude);
  const longitudes = coordinates.map(point => point.longitude);
  const north = Math.max(...latitudes);
  const south = Math.min(...latitudes);
  const east = Math.max(...longitudes);
  const west = Math.min(...longitudes);

  // Padding is in pixels, so it costs a share of the frame: the track has to
  // fit the part left over, which stretches the region by that ratio.
  const usableWidth = frame.width - padding.left - padding.right;
  const usableHeight = frame.height - padding.top - padding.bottom;
  const widthRatio = usableWidth > 0 ? frame.width / usableWidth : 1;
  const heightRatio = usableHeight > 0 ? frame.height / usableHeight : 1;

  return {
    latitude: (north + south) / 2,
    longitude: (east + west) / 2,
    latitudeDelta: (north - south) * heightRatio || POINT_REGION_DELTA,
    longitudeDelta: (east - west) * widthRatio || POINT_REGION_DELTA,
  };
}
