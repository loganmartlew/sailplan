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
 * Tightened 2026-07-06 after **Package G** (noise-tolerant grid): a clustered
 * grid built when exact-TWS grouping fails revives the bilinear path on logged
 * data, so `bilinearServed` jumps from 0 to ~84 % on the noisy fixtures. Its
 * de-noised speed estimates also improve leader accuracy on `with-limits`
 * (23 → 14) and `upwind` (4 → 2) and hold `noisy-log`/`clean-grid`. See
 * `docs/sail-suggestion/package-g-noise-tolerant-grid.md`.
 *
 * Prior tightening (2026-07-06) was **Package F** (coverage-aware ranking):
 * implicit TWA envelopes collapsed the extrapolation failures on every fixture
 * whose mis-ranked sails lack explicit limits. See
 * `docs/sail-suggestion/package-f-coverage-aware-ranking.md`.
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
  // 90 conditions; 2.2 % wrong leader (13.3 % strict), 0 % absent, 84.3 % bilinear.
  // G revives bilinear (0 → 455) and holds leader accuracy. (pre-F: 52.2 %.)
  'noisy-log': {
    wrongLeaderAdjusted: 2,
    expectedAbsentAdjusted: 0,
    bilinearServed: 455,
  },
  // 90 conditions; 0 % wrong leader (0 % strict), 0 % absent, 85.2 % bilinear.
  // Held byte-for-byte: clustering reduces to the exact grid on clean data.
  // (pre-F: 31.1 % / 1.1 % / 85.2 %.)
  'clean-grid': {
    wrongLeaderAdjusted: 0,
    expectedAbsentAdjusted: 0,
    bilinearServed: 460,
  },
  // 90 conditions; 15.6 % wrong leader (33.3 % strict), 6.7 % absent, 84.3 % bilinear.
  // G's de-noised speeds improve ranking (F: 23 → 14); residual = explicitly-
  // limited sails extrapolating past their limits. (pre-F: 54.4 %.)
  'with-limits': {
    wrongLeaderAdjusted: 14,
    expectedAbsentAdjusted: 6,
    bilinearServed: 455,
  },
  // 120 conditions (30 skipped in the 60–95° gap); 1.7 % wrong leader
  // (9.2 % strict), 0 % absent, 58.6 % bilinear. G: F's 4 → 2, 20 → 492.
  // (pre-F: 44.2 % / 12.5 % / 2.4 %.)
  upwind: {
    wrongLeaderAdjusted: 2,
    expectedAbsentAdjusted: 0,
    bilinearServed: 492,
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
