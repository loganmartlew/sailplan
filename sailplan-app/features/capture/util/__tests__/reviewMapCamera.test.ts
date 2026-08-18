import {
  initialReviewMapCamera,
  regionForCoordinates,
  rescaleRegion,
  stepReviewMapCamera,
} from '../reviewMapCamera';

const framed = { ...initialReviewMapCamera, framed: true };

describe('stepReviewMapCamera', () => {
  it('frames on the first layout', () => {
    expect(stepReviewMapCamera(initialReviewMapCamera, 'layout', true))
      .toEqual({ state: framed, fit: true });
  });

  it('does not re-frame on later layouts, so a resize never moves the camera', () => {
    expect(stepReviewMapCamera(framed, 'layout', true))
      .toEqual({ state: framed, fit: false });
  });

  it('frames when the track first arrives', () => {
    expect(stepReviewMapCamera(initialReviewMapCamera, 'trackChange', true))
      .toEqual({ state: framed, fit: true });
  });

  it('leaves the camera alone when a span edit changes the track', () => {
    expect(stepReviewMapCamera(framed, 'trackChange', true))
      .toEqual({ state: framed, fit: false });
  });

  it('frames on a focus change even after the sailor has zoomed', () => {
    const zoomed = stepReviewMapCamera(framed, 'gesture', true);
    expect(zoomed.fit).toBe(false);
    expect(stepReviewMapCamera(zoomed.state, 'focusChange', true))
      .toEqual({ state: framed, fit: true });
  });

  it('frames on recenter', () => {
    expect(stepReviewMapCamera(framed, 'recenter', true))
      .toEqual({ state: framed, fit: true });
  });

  it('stays unframed while there is nothing to frame, so the first fix still fits', () => {
    const empty = stepReviewMapCamera(initialReviewMapCamera, 'layout', false);
    expect(empty).toEqual({ state: initialReviewMapCamera, fit: false });
    expect(stepReviewMapCamera(empty.state, 'trackChange', true))
      .toEqual({ state: framed, fit: true });
  });
});

describe('rescaleRegion', () => {
  const region = {
    latitude: -36.8,
    longitude: 174.7,
    latitudeDelta: 0.02,
    longitudeDelta: 0.01,
  };

  it('holds the centre so every point stays where it was', () => {
    const grown = rescaleRegion(
      region,
      { width: 350, height: 224 },
      { width: 400, height: 800 },
    );
    expect(grown.latitude).toBe(region.latitude);
    expect(grown.longitude).toBe(region.longitude);
  });

  it('scales each delta by its own dimension, keeping degrees per pixel', () => {
    const grown = rescaleRegion(
      region,
      { width: 350, height: 224 },
      { width: 700, height: 448 },
    );
    expect(grown.latitudeDelta).toBeCloseTo(0.04, 10);
    expect(grown.longitudeDelta).toBeCloseTo(0.02, 10);
  });

  it('grows height alone when only the height grows', () => {
    const grown = rescaleRegion(
      region,
      { width: 350, height: 224 },
      { width: 350, height: 672 },
    );
    expect(grown.latitudeDelta).toBeCloseTo(0.06, 10);
    expect(grown.longitudeDelta).toBeCloseTo(0.01, 10);
  });

  it('is reversible, so collapsing lands back on the region it grew from', () => {
    const from = { width: 350, height: 224 };
    const to = { width: 412, height: 915 };
    const back = rescaleRegion(rescaleRegion(region, from, to), to, from);
    expect(back.latitudeDelta).toBeCloseTo(region.latitudeDelta, 10);
    expect(back.longitudeDelta).toBeCloseTo(region.longitudeDelta, 10);
  });

  it('returns the region untouched when a frame has not been measured yet', () => {
    expect(rescaleRegion(region, { width: 0, height: 0 }, { width: 400, height: 800 }))
      .toEqual(region);
  });

  it('never spans more than the globe', () => {
    const grown = rescaleRegion(region, { width: 1, height: 1 }, { width: 4000, height: 8000 });
    expect(grown.latitudeDelta).toBeLessThanOrEqual(180);
    expect(grown.longitudeDelta).toBeLessThanOrEqual(360);
  });
});

describe('regionForCoordinates', () => {
  const frame = { width: 350, height: 224 };
  const padding = { top: 56, right: 56, bottom: 40, left: 56 };
  const track = [
    { latitude: -36.81, longitude: 174.69 },
    { latitude: -36.79, longitude: 174.71 },
  ];

  it('centres on the coordinates it has to hold', () => {
    const region = regionForCoordinates(track, frame, padding);
    expect(region!.latitude).toBeCloseTo(-36.8, 10);
    expect(region!.longitude).toBeCloseTo(174.7, 10);
  });

  it('leaves the requested padding around the track, as fitToCoordinates does', () => {
    const region = regionForCoordinates(track, frame, padding);
    // 224 px tall, 96 px of it padding: the track spans the remaining 128.
    expect(region!.latitudeDelta).toBeCloseTo(0.02 * (224 / 128), 10);
    expect(region!.longitudeDelta).toBeCloseTo(0.02 * (350 / 238), 10);
  });

  it('gives a single fix a region rather than a point', () => {
    const region = regionForCoordinates([track[0]], frame, padding);
    expect(region!.latitudeDelta).toBeGreaterThan(0);
    expect(region!.longitudeDelta).toBeGreaterThan(0);
  });

  it('has no region to offer without coordinates or a measured frame', () => {
    expect(regionForCoordinates([], frame, padding)).toBeNull();
    expect(regionForCoordinates(track, { width: 0, height: 0 }, padding)).toBeNull();
  });

  it('falls back to the whole frame when padding would leave no room', () => {
    const tiny = { width: 80, height: 60 };
    const region = regionForCoordinates(track, tiny, padding);
    expect(region!.latitudeDelta).toBeCloseTo(0.02, 10);
    expect(region!.longitudeDelta).toBeCloseTo(0.02, 10);
  });
});
