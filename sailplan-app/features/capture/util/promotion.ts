import type { ReplayCaptureSample } from './replayCaptureSession';
import { findSteadyStretches, type SteadyStretch } from './steadyState';
import { median } from './statistics';

/**
 * Bin geometry, matching the clustered polar grid's own resolution
 * (`DEFAULT_INTERPOLATION_CONFIG.twsClusterTolerance` / `twaBinDeg`), with
 * points emitted at **bin centres**: integer knots, and multiples of 4 degrees
 * where `binColumnByTwa`'s `round(twa / 4)` puts its nodes.
 *
 * Centres are what keep a race off the single-column collapse, but not by the
 * route the width suggests. `buildClusteredPolarGrid` starts a new column only
 * when the TWS gap is **greater** than the tolerance, and two adjacent centres
 * sit exactly 1 kn apart — so the clustered builder would merge the whole race
 * into one column at the mean. What saves it is that binning to centres makes
 * promoted points share *exact* TWS values, which is the one thing raw scatter
 * never does: the exact-TWS `buildPolarGrid` is tried first, finds real
 * columns, and the clustered fallback is never reached. Widen these bins beyond
 * the cluster tolerance and that stops being true.
 */
export const TWS_BIN_WIDTH = 1;
export const TWA_BIN_WIDTH = 4;

/**
 * Samples a bin needs before it proposes anything.
 *
 * Thirty is the spec's proxy for "roughly two independent 15 s stretches rather
 * than one long one" — the reasoning being that a median should reflect the
 * boat settling into a condition repeatably, not one stretch's trim or wave
 * state. It is only a proxy: a single settled 30 s stretch clears it just as a
 * pair of 15 s ones does, and nothing here records which stretch a sample came
 * from. Spec section 9.4 chose the count deliberately over a stretch-counting
 * rule; user story 69 asks for the stronger thing.
 *
 * Checked **before** outlier cleanup: cleanup answers "is this reading
 * believable", not "did this bin earn a point".
 */
export const MIN_BIN_SAMPLES = 30;

/** Retain `x` when `|x - m| <= OUTLIER_MAD_MULTIPLE * max(MAD, MAD_FLOOR_KN)`. */
export const OUTLIER_MAD_MULTIPLE = 4;

/**
 * The wire resolution, and the floor under MAD. Boat speed arrives quantised to
 * 0.1 kn, so a minimum-size bin can legitimately hold a single repeated value,
 * put `MAD = 0`, and — without this floor — reject every reading that is not
 * bit-identical to the median.
 */
export const MAD_FLOOR_KN = 0.1;

/**
 * An interval of the recording claimed by one sail. Promotion consumes
 * *confirmed* spans only; the caller decides what confirmed means (a stored
 * `sailSpan` under a confirmed, used leg — or, in a replay, the draft
 * attribution standing in for one).
 *
 * `legOrdinal` is the leg as the sailor reviews it: a leg interrupted by a data
 * gap is stored as several rows sharing one ordinal, and they are one leg here
 * too.
 */
export type PromotionSpan = {
  legOrdinal: number;
  startTime: number;
  endTime: number;
  sailId: number | null;
};

/**
 * One proposed polar point: a sail's speed through one bin of one leg, before
 * anything is written.
 *
 * Bins are scoped to the **leg**, not the race. A leg is the unit the sailor
 * confirms and the unit that is allowed to yield nothing, and evidence from two
 * legs an hour apart is not the repeat this rule is asking for — it is two
 * conditions that happened to round to the same node. Legs that agree still
 * agree downstream: the grid builders collapse rows sharing a (TWS, TWA) node
 * with a median, deliberately neutrally.
 */
export type ProposedPolarPoint = {
  legOrdinal: number;
  sailId: number;
  /** Bin centre, knots. */
  tws: number;
  /** Bin centre, degrees, unsigned — both tacks merge here. */
  twa: number;
  /** Median boat speed of the retained samples, knots. */
  speed: number;
  /** Qualifying samples in the bin, as counted against {@link MIN_BIN_SAMPLES}. */
  sampleCount: number;
  /** Of those, the samples outlier rejection kept. */
  retainedCount: number;
};

/**
 * A stored sailed leg, as promotion needs to read it. Deliberately structural:
 * the row type carries a dozen columns promotion has no opinion about.
 */
export type ReviewableLeg = {
  ordinal: number;
  reviewedAt: number | null;
  used: boolean;
  sailSpans: readonly { startTime: number; endTime: number; sailId: number | null }[];
};

/**
 * The spans promotion is allowed to take points from.
 *
 * Only a **reviewed** leg's spans can produce points — an unreviewed leg still
 * carries the app's draft attribution, which is a hypothesis the sailor has not
 * stood behind — and only legs the sailor kept. Striking a leg out is how they
 * say "this one was not sailing", and it has to mean the leg contributes
 * nothing rather than merely looking different on screen.
 */
export function reviewedSpans(
  legs: readonly ReviewableLeg[],
): PromotionSpan[] {
  return legs
    .filter(leg => leg.reviewedAt !== null && leg.used)
    .flatMap(leg =>
      leg.sailSpans.map(span => ({
        legOrdinal: leg.ordinal,
        startTime: span.startTime,
        endTime: span.endTime,
        sailId: span.sailId,
      })),
    );
}

const twsBinCentre = (tws: number) =>
  Math.round(tws / TWS_BIN_WIDTH) * TWS_BIN_WIDTH;
const twaBinCentre = (twa: number) =>
  Math.round(Math.abs(twa) / TWA_BIN_WIDTH) * TWA_BIN_WIDTH;

const within = (
  timestamp: number,
  interval: { startTime: number; endTime: number },
) => timestamp >= interval.startTime && timestamp < interval.endTime;

/**
 * Drops the readings a bin cannot believe, then returns what is left. The
 * threshold is self-calibrating — no boat-specific maximum speed to invent —
 * and floored at the wire resolution so a quantised bin cannot reject itself.
 */
function retainedSpeeds(speeds: readonly number[]): number[] {
  const centre = median(speeds);
  const deviation = median(speeds.map(speed => Math.abs(speed - centre)));
  const threshold = OUTLIER_MAD_MULTIPLE * Math.max(deviation, MAD_FLOOR_KN);
  return speeds.filter(speed => Math.abs(speed - centre) <= threshold);
}

/**
 * The polar points a session's confirmed spans would yield.
 *
 * Confirmed spans are intersected with the steadiness mask — the same mask
 * attribution reads, computed once over the whole session and sail-independently
 * — and what survives is binned, checked for evidence, cleaned of glitches and
 * reduced to a median. The filter does the sailing-quality work, which is why
 * the statistic only has to handle measurement noise, and why it is a median
 * rather than a percentile.
 *
 * Nothing here writes. A leg that produces no point is an ordinary outcome.
 */
export function proposePolarPoints(
  samples: readonly ReplayCaptureSample[],
  spans: readonly PromotionSpan[],
  steady: readonly SteadyStretch[] = findSteadyStretches(samples),
): ProposedPolarPoint[] {
  const attributed = spans.filter(
    (span): span is PromotionSpan & { sailId: number } => span.sailId !== null,
  );
  if (attributed.length === 0) return [];

  const bins = new Map<string, { key: Omit<ProposedPolarPoint, 'speed' | 'sampleCount' | 'retainedCount'>; speeds: number[] }>();
  for (const sample of samples) {
    if (sample.tws === null || sample.twa === null || sample.stw === null) continue;
    const span = attributed.find(candidate => within(sample.timestamp, candidate));
    if (!span) continue;
    if (!steady.some(stretch => within(sample.timestamp, stretch))) continue;

    const key = {
      legOrdinal: span.legOrdinal,
      sailId: span.sailId,
      tws: twsBinCentre(sample.tws),
      twa: twaBinCentre(sample.twa),
    };
    const id = `${key.legOrdinal}|${key.sailId}|${key.tws}|${key.twa}`;
    const bin = bins.get(id);
    if (bin) bin.speeds.push(sample.stw);
    else bins.set(id, { key, speeds: [sample.stw] });
  }

  return [...bins.values()]
    .filter(bin => bin.speeds.length >= MIN_BIN_SAMPLES)
    .map(bin => {
      const retained = retainedSpeeds(bin.speeds);
      return {
        ...bin.key,
        speed: median(retained),
        sampleCount: bin.speeds.length,
        retainedCount: retained.length,
      };
    })
    .sort(
      (first, second) =>
        first.legOrdinal - second.legOrdinal
        || first.sailId - second.sailId
        || first.tws - second.tws
        || first.twa - second.twa,
    );
}
