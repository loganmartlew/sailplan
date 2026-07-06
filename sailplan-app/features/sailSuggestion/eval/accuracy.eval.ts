import * as fs from 'fs';
import * as path from 'path';
import { buildFixture, type FixtureManifest } from './fixture';
import { formatSweepReport, runAccuracySweep } from './sweep';

/**
 * Opt-in accuracy evaluation for the sail-suggestion engine (Package E).
 *
 * NOT part of the default jest run — the `.eval.ts` suffix matches no default
 * testMatch pattern. Run it with:
 *
 *   npm run eval:suggestions        (from sailplan-app/)
 *
 * For each fixture in `polars/fixtures/` it sweeps the manifest's condition
 * space through the real `suggestSails` pipeline (default config), prints the
 * per-fixture report, and enforces a **ratchet** against the locked baseline:
 * accuracy may improve or hold, never regress. When a package (F/G/H) lands
 * an improvement, tighten the numbers here and record them in
 * `docs/sail-suggestion/accuracy-review.md`.
 */

const FIXTURES_DIR = path.resolve(__dirname, '../../../../polars/fixtures');

/**
 * Locked baselines — absolute counts (the fixtures and engine are
 * deterministic). `wrongLeaderAdjusted` / `expectedAbsentAdjusted` are
 * ceilings; `bilinearServed` is a floor.
 *
 * Tightened 2026-07-06 after **Package F** (coverage-aware ranking): implicit
 * TWA envelopes collapse the extrapolation failures on every fixture whose
 * mis-ranked sails lack explicit limits. `with-limits` improves less because
 * its residual failures are explicitly-limited sails (A2/A6) still extrapolating
 * past their user limits — F leaves the explicit path untouched by design; a
 * follow-up (extend trust-suppression to explicit limits) is the next lever.
 * See `docs/sail-suggestion/package-f-coverage-aware-ranking.md`.
 *
 * Pre-F baselines (packages 0/A–D) in parentheses for reference.
 */
const BASELINES: Record<
  string,
  {
    wrongLeaderAdjusted: number;
    expectedAbsentAdjusted: number;
    bilinearServed: number;
  }
> = {
  // 90 conditions; 2.2 % wrong leader (13.3 % strict), 0 % absent, 0 % bilinear.
  // (pre-F: 52.2 % / 12.2 % / 0 %.)
  'noisy-log': {
    wrongLeaderAdjusted: 2,
    expectedAbsentAdjusted: 0,
    bilinearServed: 0,
  },
  // 90 conditions; 0 % wrong leader (0 % strict), 0 % absent, 85.2 % bilinear.
  // (pre-F: 31.1 % / 1.1 % / 85.2 %.)
  'clean-grid': {
    wrongLeaderAdjusted: 0,
    expectedAbsentAdjusted: 0,
    bilinearServed: 460,
  },
  // 90 conditions; 25.6 % wrong leader (37.8 % strict), 10 % absent, 0 % bilinear.
  // Residual = explicitly-limited sails extrapolating past their limits (see above).
  // (pre-F: 54.4 % / 14.4 % / 0 %.)
  'with-limits': {
    wrongLeaderAdjusted: 23,
    expectedAbsentAdjusted: 9,
    bilinearServed: 0,
  },
  // 120 conditions (30 skipped in the 60–95° gap); 3.3 % wrong leader
  // (10.8 % strict), 0 % absent, 2.4 % bilinear. (pre-F: 44.2 % / 12.5 % / 2.4 %.)
  upwind: {
    wrongLeaderAdjusted: 4,
    expectedAbsentAdjusted: 0,
    bilinearServed: 20,
  },
};

const FIXTURE_NAMES = Object.keys(BASELINES);

describe.each(FIXTURE_NAMES)('accuracy sweep: %s', name => {
  const manifest: FixtureManifest = JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, `${name}.manifest.json`), 'utf8'),
  );
  const csv = fs.readFileSync(path.join(FIXTURES_DIR, `${name}.csv`), 'utf8');
  const fixture = buildFixture(manifest, csv);
  const report = runAccuracySweep(fixture);

  it('reports the sweep', () => {
    console.log(formatSweepReport(report));
    expect(report.conditions.length).toBeGreaterThan(0);
    // Every scored condition has a non-empty acceptable set by construction.
    for (const c of report.conditions) {
      expect(c.acceptable).toContain(c.expected);
    }
  });

  it('does not regress the locked baseline', () => {
    const baseline = BASELINES[name];
    expect(report.wrongLeaderAdjusted).toBeLessThanOrEqual(
      baseline.wrongLeaderAdjusted,
    );
    expect(report.expectedAbsentAdjusted).toBeLessThanOrEqual(
      baseline.expectedAbsentAdjusted,
    );
    expect(report.bilinearServed).toBeGreaterThanOrEqual(
      baseline.bilinearServed,
    );
  });
});
