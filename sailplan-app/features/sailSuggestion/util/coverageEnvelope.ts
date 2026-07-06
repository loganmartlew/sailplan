import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import type { SuggestionConfig } from '../model/suggestionConfig';
import type { InterpolatedLimits } from './limitScoring';

/**
 * Derives an *implicit* TWA envelope for a sail from its own polar coverage,
 * for use when the sail has no explicit user-entered TWA limits (product
 * decision D2). The observed spread of TWA at the relevant wind speed is
 * treated as the sail's usable range: angles it was never logged at are
 * out-of-range, not trusted extrapolations.
 *
 * The result is shaped as {@link InterpolatedLimits} so it drops straight into
 * the same {@link computeLimitScore} trapezoid the explicit-limit path uses —
 * the architecture already has the socket; this feeds it.
 *
 * Robustness (the input is noisy logged scatter as often as a clean table):
 * - Only points within `twsTolerance` knots of the target TWS define the
 *   envelope, so a sail whose usable band shifts with wind speed isn't scored
 *   against the wrong region. Falls back to the full point set when the local
 *   window is too sparse to speak to (bands are only weakly TWS-dependent).
 * - The TWA span is taken from trimmed quantiles, not raw min/max, so a single
 *   mis-logged point (a GPS/instrument glitch) can't balloon the envelope.
 * - `marginDeg` expands the span outward so discretisation and edge noise don't
 *   clip a legitimately-sailed edge angle (aligned with D3's one-grid-step
 *   boundary tolerance).
 *
 * Returns `null` when an envelope can't be trusted — no polar data, or fewer
 * than `minPoints` points to derive a span from. A null result means "no
 * implicit limit"; the caller then scores the sail on polars alone, as before.
 */
export function deriveCoverageEnvelope(
  tws: number,
  polars: PolarPoint[],
  config: SuggestionConfig['coverageEnvelope'],
): InterpolatedLimits | null {
  if (polars.length < config.minPoints) return null;

  // Prefer points near the target TWS; fall back to the full set when the local
  // window is too sparse to assert a region on its own.
  const near = polars.filter(p => Math.abs(p.tws - tws) <= config.twsTolerance);
  const region = near.length >= config.minPoints ? near : polars;
  if (region.length < config.minPoints) return null;

  const twas = region.map(p => p.twa).sort((a, b) => a - b);
  const n = twas.length;
  // Trim the same count off each end; `cut < n / 2` for any trimFraction < 0.5,
  // so the low/high picks never cross.
  const cut = Math.floor(config.trimFraction * n);
  const loTwa = twas[cut];
  const hiTwa = twas[n - 1 - cut];

  return {
    minTwa: loTwa - config.marginDeg,
    maxTwa: hiTwa + config.marginDeg,
  };
}
