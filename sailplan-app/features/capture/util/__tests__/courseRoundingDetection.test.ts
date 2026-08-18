import {
  detectCourseRoundings,
  ROUNDING_GUARD_METRES,
  type CourseRoundingMark,
  type RoundingFix,
} from '../courseRoundingDetection';

const start = 1_700_000_000_000;

/** Metres north / east of an origin, in degrees, near 36°S. */
const METRE_LAT = 1 / 111_320;
const METRE_LON = 1 / (111_320 * Math.cos((36.8 * Math.PI) / 180));
const ORIGIN = { latitude: -36.8, longitude: 174.8 };

const at = (north: number, east: number) => ({
  latitude: ORIGIN.latitude + north * METRE_LAT,
  longitude: ORIGIN.longitude + east * METRE_LON,
});

const mark = (
  id: number,
  name: string,
  north: number,
  east: number,
): CourseRoundingMark => ({ id, name, ...at(north, east) });

/**
 * A track through the given points at one fix a second, straight between them,
 * `stepMetres` apart — the shape of a sailed course reduced to what rounding
 * detection actually reads.
 */
function trackThrough(
  points: readonly { north: number; east: number }[],
  stepMetres = 20,
): RoundingFix[] {
  const fixes: RoundingFix[] = [];
  let second = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const span = Math.hypot(to.north - from.north, to.east - from.east);
    const steps = Math.max(1, Math.round(span / stepMetres));
    for (let step = 0; step < steps; step += 1) {
      const fraction = step / steps;
      const position = at(
        from.north + (to.north - from.north) * fraction,
        from.east + (to.east - from.east) * fraction,
      );
      fixes.push({
        timestamp: start + second * 1_000,
        lat: position.latitude,
        lon: position.longitude,
      });
      second += 1;
    }
  }
  const last = points.at(-1)!;
  const position = at(last.north, last.east);
  fixes.push({ timestamp: start + second * 1_000, lat: position.latitude, lon: position.longitude });
  return fixes;
}

const point = (north: number, east: number) => ({ north, east });
const secondsIn = (timestamp: number) => (timestamp - start) / 1_000;

describe('detectCourseRoundings', () => {
  it('finds one rounding per mark, in the order the marks were sailed', () => {
    const marks = [
      mark(1, 'Start', 0, 0),
      mark(2, 'Windward', 2_000, 0),
      mark(3, 'Leeward', 0, 400),
    ];
    const track = trackThrough([
      point(-200, -200),
      point(0, 0),
      point(2_000, 0),
      point(0, 400),
      point(-200, 600),
    ]);

    const roundings = detectCourseRoundings(track, marks);

    expect(roundings.map(rounding => rounding?.courseMarkId)).toEqual([1, 2, 3]);
    expect(roundings.every(rounding => rounding!.metres < 20)).toBe(true);
    const times = roundings.map(rounding => rounding!.at);
    expect(times[0]).toBeLessThan(times[1]);
    expect(times[1]).toBeLessThan(times[2]);
  });

  it('gives a mark its own pass rather than a nearer later one', () => {
    // The real race's blind spot: the first North Head pass is 143 m out (a via
    // point the headland forces the boat around) and the second is 16 m. Taking
    // each mark's global closest approach assigns the second pass to the first
    // mark and drags every later mark forward until one collapses.
    const marks = [
      mark(1, 'Headland', 0, 0),
      mark(2, 'Top', 2_000, 0),
      mark(3, 'Headland again', 0, 0),
      mark(4, 'Finish', -1_000, 500),
    ];
    const track = trackThrough([
      point(-1_000, 300),
      point(-140, 140), // 198 m off the headland on the way up
      point(2_000, 0),
      point(0, 15), // 15 m off it on the way back
      point(-1_000, 500),
    ]);

    const roundings = detectCourseRoundings(track, marks);

    expect(roundings.map(rounding => rounding?.courseMarkId)).toEqual([1, 2, 3, 4]);
    expect(Math.round(roundings[0]!.metres)).toBeGreaterThan(100);
    expect(Math.round(roundings[2]!.metres)).toBeLessThan(30);
    expect(roundings[0]!.at).toBeLessThan(roundings[1]!.at);
    expect(roundings[1]!.at).toBeLessThan(roundings[2]!.at);
  });

  it('resolves two passes of one mark that never leave the guard radius', () => {
    // A short course can keep the boat inside the radius the whole race, so
    // passes cannot be separated by leaving it — only by receding and returning.
    const marks = [
      mark(1, 'Pin', 0, 0),
      mark(2, 'Outer', 400, 0),
      mark(3, 'Pin again', 0, 0),
    ];
    const track = trackThrough([
      point(-100, 0),
      point(0, 5),
      point(400, 0),
      point(0, 10),
      point(-100, 20),
    ]);

    const roundings = detectCourseRoundings(track, marks);

    expect(roundings.map(rounding => rounding?.courseMarkId)).toEqual([1, 2, 3]);
    expect(roundings[0]!.at).toBeLessThan(roundings[2]!.at);
    expect(secondsIn(roundings[2]!.at) - secondsIn(roundings[0]!.at)).toBeGreaterThan(10);
  });

  it('leaves a mark the boat never came near unassigned, and keeps the rest', () => {
    const marks = [
      mark(1, 'Start', 0, 0),
      mark(2, 'Stale', 40_000, 40_000),
      mark(3, 'Finish', 2_000, 0),
    ];
    const track = trackThrough([point(-200, 0), point(0, 0), point(2_000, 0)]);

    const roundings = detectCourseRoundings(track, marks);

    expect(roundings.map(rounding => rounding?.courseMarkId ?? null)).toEqual([1, null, 3]);
  });

  it('never claims a pass outside the guard radius', () => {
    const marks = [mark(1, 'Start', 0, 0), mark(2, 'Offset', 0, ROUNDING_GUARD_METRES + 400)];
    const track = trackThrough([point(-200, 0), point(0, 0), point(200, 0)]);

    const roundings = detectCourseRoundings(track, marks);

    expect(roundings[0]).not.toBeNull();
    expect(roundings[1]).toBeNull();
  });

  it('ignores fixes with no position', () => {
    const marks = [mark(1, 'Start', 0, 0), mark(2, 'Finish', 2_000, 0)];
    const track: RoundingFix[] = trackThrough([point(-200, 0), point(0, 0), point(2_000, 0)]).map(
      (fix, index) => (index % 3 === 1 ? { ...fix, lat: null, lon: null } : fix),
    );

    const roundings = detectCourseRoundings(track, marks);

    expect(roundings.map(rounding => rounding?.courseMarkId ?? null)).toEqual([1, 2]);
  });

  it('has nothing to say without positions or marks', () => {
    expect(detectCourseRoundings([], [mark(1, 'Start', 0, 0)])).toEqual([null]);
    expect(detectCourseRoundings(trackThrough([point(0, 0), point(100, 0)]), [])).toEqual([]);
  });
});
