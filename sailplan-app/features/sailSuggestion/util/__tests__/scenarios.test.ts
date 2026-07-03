import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import type { RankedSailEvaluation } from '../../model/sailEvaluation';
import type { SailSuggestionResult } from '../../model/sailSuggestion';
import { suggestSails } from '../suggestSails';

/**
 * Scenario gate for Package A (the scoring core).
 *
 * Each case builds a small fleet through the public `suggestSails` API and
 * asserts *which sail wins* / ordering properties — never exact scores — so the
 * table survives constant tuning and doubles as the regression harness for the
 * later interpolation upgrade (Package D). See
 * `docs/sail-suggestion/package-a-scoring-core.md` for the design rationale.
 */

// --- Fixture helpers --------------------------------------------------------

let nextSailId = 1;

function makeSail(name: string, symmetrical: boolean): Sail {
  return {
    id: nextSailId++,
    name,
    color: '#ffffff',
    sailArea: null,
    symmetrical,
    masthead: false,
    boatProfileId: 1,
  };
}

/**
 * Builds a dense polar grid (TWS columns × TWA rows), mirroring what the
 * `polars/` generator emits. `speedFn` defaults to a constant so callers that
 * only care about confidence/ordering can ignore the speed surface.
 */
function makeGrid(
  twsValues: number[],
  twaValues: number[],
  speedFn: number | ((tws: number, twa: number) => number),
): PolarPoint[] {
  const fn = typeof speedFn === 'function' ? speedFn : () => speedFn;
  const points: PolarPoint[] = [];
  for (const tws of twsValues) {
    for (const twa of twaValues) {
      points.push({ tws, twa, speed: fn(tws, twa) });
    }
  }
  return points;
}

function makeLimits(
  sailId: number,
  rows: { tws: number; minTwa: number | null; maxTwa: number | null }[],
): SailTwaLimit[] {
  return rows.map(r => ({
    id: 0,
    sailId,
    tws: r.tws,
    minTwa: r.minTwa,
    maxTwa: r.maxTwa,
  }));
}

// --- Result helpers ---------------------------------------------------------

function orderedNames(result: SailSuggestionResult): string[] {
  return result.evaluations.map(e => e.sail.name);
}

function evalFor(
  result: SailSuggestionResult,
  name: string,
): RankedSailEvaluation {
  const found = result.evaluations.find(e => e.sail.name === name);
  if (!found) throw new Error(`No evaluation for sail "${name}"`);
  return found;
}

function rankOf(result: SailSuggestionResult, name: string): number {
  return result.evaluations.findIndex(e => e.sail.name === name);
}

// A dense grid produces high confidence (w = 1, polars dominate); a couple of
// off-target points produce moderate/low confidence (limits contribute).
const DENSE_TWS = [11, 13, 15, 17];
const DENSE_TWA = [140, 150, 160, 170, 180];

// ---------------------------------------------------------------------------

describe('sail suggestion scenarios', () => {
  beforeEach(() => {
    nextSailId = 1;
  });

  // S1 — dead band: a runner at 170° is fastest and wins; the asym at 170°
  // (the top edge of the 150–170° dead band) is not penalised at all.
  it('S1: symmetric runner wins at 170°; asym not penalised by the guard', () => {
    const runner = makeSail('Runner', true);
    const asym = makeSail('Asym', false);
    const slow = makeSail('Slow', false);

    const polars = new Map<number, PolarPoint[]>([
      [runner.id, makeGrid(DENSE_TWS, DENSE_TWA, 8)],
      [asym.id, makeGrid(DENSE_TWS, DENSE_TWA, 6.5)],
      [slow.id, makeGrid(DENSE_TWS, DENSE_TWA, 4)],
    ]);

    const result = suggestSails(170, 15, [runner, asym, slow], polars, new Map());

    expect(orderedNames(result)[0]).toBe('Runner');
    // 170° sits inside the dead band — no symmetry penalty for the asym.
    expect(evalFor(result, 'Asym').reasoning.guardPenaltyTotal).toBe(0);
    // …and it stays ahead of the genuinely slower sail.
    expect(rankOf(result, 'Asym')).toBeLessThan(rankOf(result, 'Slow'));
  });

  // S2 — cap/slope: an asym wins on speed at 140°; the symmetric runner takes a
  // real but small guard penalty (≤ maxPenalty 0.2), never a veto.
  it('S2: asym wins at 140°; runner guard penalty stays ≤ 0.2', () => {
    const asym = makeSail('Asym', false);
    const runner = makeSail('Runner', true);

    const polars = new Map<number, PolarPoint[]>([
      [asym.id, makeGrid([9, 11, 13, 15], [120, 130, 140, 150, 160], 8)],
      [runner.id, makeGrid([9, 11, 13, 15], [120, 130, 140, 150, 160], 6.5)],
    ]);

    const result = suggestSails(140, 12, [asym, runner], polars, new Map());

    expect(orderedNames(result)[0]).toBe('Asym');
    const penalty = evalFor(result, 'Runner').reasoning.guardPenaltyTotal;
    expect(penalty).toBeGreaterThan(0);
    expect(penalty).toBeLessThanOrEqual(0.2);
  });

  // S3 — evidence bonus: a proven kite (dense polars) beats a limits-only kite
  // when both are otherwise perfect in-window.
  it('S3: polars-proven kite beats a limits-only kite', () => {
    const proven = makeSail('Proven', false);
    const limitsOnly = makeSail('LimitsOnly', false);

    const window = [
      { tws: 10, minTwa: 120, maxTwa: 160 },
      { tws: 15, minTwa: 120, maxTwa: 160 },
    ];

    const polars = new Map<number, PolarPoint[]>([
      [proven.id, makeGrid([10, 12, 14], [120, 130, 140, 150, 160], 7)],
      [limitsOnly.id, []],
    ]);
    const limits = new Map<number, SailTwaLimit[]>([
      [proven.id, makeLimits(proven.id, window)],
      [limitsOnly.id, makeLimits(limitsOnly.id, window)],
    ]);

    const result = suggestSails(140, 12, [proven, limitsOnly], polars, limits);

    expect(orderedNames(result)[0]).toBe('Proven');
  });

  // S4 — defect 2: even with only patchy (moderate-confidence) polars, the
  // proven kite is not capped below the limits-only kite.
  it('S4: patchy-but-proven kite still beats a limits-only kite', () => {
    const proven = makeSail('Proven', false);
    const limitsOnly = makeSail('LimitsOnly', false);

    const window = [
      { tws: 10, minTwa: 120, maxTwa: 160 },
      { tws: 15, minTwa: 120, maxTwa: 160 },
    ];

    const polars = new Map<number, PolarPoint[]>([
      // Two off-target points → moderate confidence.
      [
        proven.id,
        [
          { tws: 10, twa: 120, speed: 7 },
          { tws: 14, twa: 158, speed: 7 },
        ],
      ],
      [limitsOnly.id, []],
    ]);
    const limits = new Map<number, SailTwaLimit[]>([
      [proven.id, makeLimits(proven.id, window)],
      [limitsOnly.id, makeLimits(limitsOnly.id, window)],
    ]);

    const result = suggestSails(140, 12, [proven, limitsOnly], polars, limits);

    expect(orderedNames(result)[0]).toBe('Proven');
  });

  // S5 — negative leader: everyone is outside their limits. The result is still
  // non-empty, the least-bad sail leads, and the result is flagged fallback.
  it('S5: all sails out of limits → non-empty fallback with least-bad leader', () => {
    const near = makeSail('Near', false);
    const mid = makeSail('Mid', false);
    const far = makeSail('Far', false);

    const limits = new Map<number, SailTwaLimit[]>([
      // Windows centred well away from the sailed 170°, "Near" the closest.
      [near.id, makeLimits(near.id, [{ tws: 12, minTwa: 120, maxTwa: 160 }])],
      [mid.id, makeLimits(mid.id, [{ tws: 12, minTwa: 100, maxTwa: 140 }])],
      [far.id, makeLimits(far.id, [{ tws: 12, minTwa: 60, maxTwa: 100 }])],
    ]);

    const result = suggestSails(170, 12, [near, mid, far], new Map(), limits);

    expect(result.isFallback).toBe(true);
    expect(result.suggested.length).toBeGreaterThanOrEqual(1);
    expect(orderedNames(result)[0]).toBe('Near');
  });

  // S6 — convergence: a sparse, low-confidence fleet ranks purely by limit fit.
  it('S6: sparse low-confidence fleet ranks by limit fit', () => {
    const good = makeSail('GoodFit', false);
    const okay = makeSail('OkayFit', false);
    const poor = makeSail('PoorFit', false);

    // One far-ish in-window point each → low but non-zero confidence.
    const sparse: PolarPoint[] = [{ tws: 14, twa: 175, speed: 5 }];
    const polars = new Map<number, PolarPoint[]>([
      [good.id, sparse],
      [okay.id, sparse],
      [poor.id, sparse],
    ]);

    const limits = new Map<number, SailTwaLimit[]>([
      // At TWA 140°: GoodFit centred (1.0), OkayFit in taper (~0.65), PoorFit at edge (0.3).
      [good.id, makeLimits(good.id, [{ tws: 12, minTwa: 120, maxTwa: 160 }])],
      [okay.id, makeLimits(okay.id, [{ tws: 12, minTwa: 103, maxTwa: 143 }])],
      [poor.id, makeLimits(poor.id, [{ tws: 12, minTwa: 100, maxTwa: 140 }])],
    ]);

    const result = suggestSails(140, 12, [good, okay, poor], polars, limits);

    expect(orderedNames(result)).toEqual(['GoodFit', 'OkayFit', 'PoorFit']);
  });

  // S7 — no cliff: nudging one sail's confidence across the old moderate/low
  // boundary (by adding a polar point) must not reorder the fleet.
  it('S7: a small confidence wobble does not reorder the fleet', () => {
    const leader = makeSail('Leader', false);
    const wobbler = makeSail('Wobbler', false);
    const trailer = makeSail('Trailer', false);

    const window = [{ tws: 12, minTwa: 120, maxTwa: 160 }];
    const limits = new Map<number, SailTwaLimit[]>([
      [leader.id, makeLimits(leader.id, window)],
      [wobbler.id, makeLimits(wobbler.id, window)],
      [trailer.id, makeLimits(trailer.id, window)],
    ]);

    const build = (extra: PolarPoint[]) =>
      new Map<number, PolarPoint[]>([
        [leader.id, makeGrid([10, 12, 14], [130, 140, 150], 8)],
        [
          wobbler.id,
          [
            { tws: 10, twa: 125, speed: 6 },
            { tws: 14, twa: 152, speed: 6 },
            ...extra,
          ],
        ],
        [trailer.id, []],
      ]);

    const without = suggestSails(140, 12, [leader, wobbler, trailer], build([]), limits);
    const withPoint = suggestSails(
      140,
      12,
      [leader, wobbler, trailer],
      build([{ tws: 12, twa: 138, speed: 6 }]),
      limits,
    );

    expect(orderedNames(without)).toEqual(orderedNames(withPoint));
    expect(orderedNames(without)[0]).toBe('Leader');
  });

  // S8 — zones no longer branch the math: ordering is stable across the wind
  // zone boundaries at 80° and 150°.
  it('S8: ordering is unchanged across zone boundaries', () => {
    const build = () => {
      const a = makeSail('Alpha', false);
      const b = makeSail('Bravo', false);
      const polars = new Map<number, PolarPoint[]>([
        [a.id, makeGrid([10, 12, 14], [70, 80, 90, 140, 150, 160], 8)],
        [b.id, makeGrid([10, 12, 14], [70, 80, 90, 140, 150, 160], 6)],
      ]);
      return { sails: [a, b], polars };
    };

    const lowerUpwind = build();
    const upperUpwind = build();
    expect(
      orderedNames(suggestSails(79.9, 12, lowerUpwind.sails, lowerUpwind.polars, new Map())),
    ).toEqual(
      orderedNames(suggestSails(80.1, 12, upperUpwind.sails, upperUpwind.polars, new Map())),
    );

    const lowerDown = build();
    const upperDown = build();
    expect(
      orderedNames(suggestSails(149.9, 12, lowerDown.sails, lowerDown.polars, new Map())),
    ).toEqual(
      orderedNames(suggestSails(150.1, 12, upperDown.sails, upperDown.polars, new Map())),
    );
  });

  // S9 — trapezoid: with identical (moderate) polars, limits differentiate, and
  // the window edge scores well above zero (not the old bell-curve ~0.07).
  it('S9: identical polars differentiated by limits; edge not punished', () => {
    const center = makeSail('Center', false);
    const edge = makeSail('Edge', false);
    const outside = makeSail('Outside', false);

    // Identical patchy polars → moderate confidence so the limit term matters.
    const patchy: PolarPoint[] = [
      { tws: 10, twa: 100, speed: 6 },
      { tws: 14, twa: 120, speed: 6 },
    ];
    const polars = new Map<number, PolarPoint[]>([
      [center.id, patchy],
      [edge.id, patchy],
      [outside.id, patchy],
    ]);

    const limits = new Map<number, SailTwaLimit[]>([
      // At TWA 140°: Center t=0 (1.0), Edge t=1 (edgeScore), Outside t>1 (negative).
      [center.id, makeLimits(center.id, [{ tws: 12, minTwa: 120, maxTwa: 160 }])],
      [edge.id, makeLimits(edge.id, [{ tws: 12, minTwa: 140, maxTwa: 180 }])],
      [outside.id, makeLimits(outside.id, [{ tws: 12, minTwa: 90, maxTwa: 130 }])],
    ]);

    const result = suggestSails(140, 12, [center, edge, outside], polars, limits);

    expect(orderedNames(result)).toEqual(['Center', 'Edge', 'Outside']);
    expect(evalFor(result, 'Center').limitScore).toBeCloseTo(1.0, 5);
    // Trapezoid edge is 0.3, not the old bell-curve ~0.07.
    expect(evalFor(result, 'Edge').limitScore!).toBeGreaterThan(0.25);
    expect(evalFor(result, 'Outside').limitScore!).toBeLessThan(0);
  });

  // S10 — open decision (skipWhenLimitsDefined): a sail the user marked good up
  // to 175° is not penalised by the guard at 172°, so an unlimited rival cannot
  // out-rank it purely via the symmetry guard.
  it('S10: user limits suppress the guard; limited sail is not out-ranked', () => {
    const limited = makeSail('Limited', false);
    const unlimited = makeSail('Unlimited', false);

    const polars = new Map<number, PolarPoint[]>([
      [limited.id, makeGrid([13, 15, 17], [160, 170, 180], 7)],
      [unlimited.id, makeGrid([13, 15, 17], [160, 170, 180], 7)],
    ]);
    const limits = new Map<number, SailTwaLimit[]>([
      [limited.id, makeLimits(limited.id, [{ tws: 15, minTwa: null, maxTwa: 175 }])],
    ]);

    const result = suggestSails(172, 15, [limited, unlimited], polars, limits);

    // User-entered limits are trusted over the hardcoded guard.
    expect(evalFor(result, 'Limited').reasoning.guardPenaltyTotal).toBe(0);
    // The unlimited asym at 172° (> 170° dead band) takes the guard penalty.
    expect(evalFor(result, 'Unlimited').reasoning.guardPenaltyTotal).toBeGreaterThan(0);
    // So the limited sail is not out-ranked purely because of the guard.
    expect(rankOf(result, 'Limited')).toBeLessThanOrEqual(rankOf(result, 'Unlimited'));
  });

  // S11 — monotonicity: raising one sail's polar speeds (limits fixed) must
  // never drop its rank (kills the moderate-tier "signals fight" defect).
  it('S11: raising a sail’s polar speed never drops its rank', () => {
    const build = (xSpeed: number) => {
      const x = makeSail('X', false);
      const y = makeSail('Y', false);
      const z = makeSail('Z', false);
      const polars = new Map<number, PolarPoint[]>([
        [x.id, makeGrid([10, 12, 14], [120, 130, 140, 150], xSpeed)],
        [y.id, makeGrid([10, 12, 14], [120, 130, 140, 150], 6.5)],
        [z.id, makeGrid([10, 12, 14], [120, 130, 140, 150], 6)],
      ]);
      const limits = new Map<number, SailTwaLimit[]>([
        [x.id, makeLimits(x.id, [{ tws: 12, minTwa: 120, maxTwa: 160 }])],
        [y.id, makeLimits(y.id, [{ tws: 12, minTwa: 120, maxTwa: 160 }])],
        [z.id, makeLimits(z.id, [{ tws: 12, minTwa: 120, maxTwa: 160 }])],
      ]);
      return suggestSails(135, 12, [x, y, z], polars, limits);
    };

    const before = build(5);
    const after = build(9);

    expect(rankOf(after, 'X')).toBeLessThanOrEqual(rankOf(before, 'X'));
  });

  // S12 — regression: no polars and no limits leaves every sail unrankable.
  it('S12: no polars and no limits → empty suggestions, all scores -Infinity', () => {
    const a = makeSail('Alpha', false);
    const b = makeSail('Bravo', true);

    const result = suggestSails(140, 12, [a, b], new Map(), new Map());

    expect(result.suggested).toHaveLength(0);
    for (const evaluation of result.evaluations) {
      expect(evaluation.rankingScore).toBe(-Infinity);
    }
  });
});
