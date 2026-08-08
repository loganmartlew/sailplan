import { estimateSailSpeed } from '~/features/sailPolar/util/interpolation';
import {
  DEFAULT_SUGGESTION_CONFIG,
  type SuggestionConfig,
} from '../model/suggestionConfig';
import { suggestSails } from '../util/suggestSails';
import { acceptableLeaders, strictExpectedWinner, type EvalFixture } from './fixture';

/**
 * Accuracy sweep for the evaluation harness (Package E).
 *
 * Runs the real `suggestSails` pipeline over a fixture's condition space and
 * scores it against the manifest's ground truth, applying the D3
 * boundary-tolerance rule (see `docs/sail-suggestion/accuracy-review.md`).
 * Pure — the opt-in eval suite feeds in a loaded fixture and prints the
 * formatted report. Harness-only; never import from app code.
 */

export interface ConditionOutcome {
  twa: number;
  tws: number;
  /** Strict band winner (fastest sail whose band contains the TWA). */
  expected: string;
  /** D3-adjusted acceptable leaders (strict winner ± boundary tolerance). */
  acceptable: string[];
  /** Name of the top-ranked sail. */
  leader: string | null;
  /** Names in the suggested list, in rank order. */
  suggested: string[];
  wrongLeaderStrict: boolean;
  wrongLeaderAdjusted: boolean;
  /** True when no acceptable leader appears anywhere in the suggested list. */
  expectedAbsentAdjusted: boolean;
}

export interface SweepReport {
  fixture: string;
  conditions: ConditionOutcome[];
  /** Sweep nodes with no in-band sail (coverage gaps) — not scored. */
  skipped: { twa: number; tws: number }[];
  wrongLeaderStrict: number;
  wrongLeaderAdjusted: number;
  expectedAbsentAdjusted: number;
  /** Sail-evaluations (sail × scored condition) served by the bilinear path. */
  bilinearServed: number;
  totalSailEvaluations: number;
}

/**
 * Sweeps the fixture's condition space (from its manifest) through
 * `suggestSails` and scores every condition against ground truth.
 *
 * The bilinear metric re-runs `estimateSailSpeed` with `strategy: 'bilinear'`
 * per sail × condition: with the default `'auto'` strategy the pipeline tries
 * bilinear first, so "forced-bilinear succeeds" is exactly "the real
 * evaluation was served by the bilinear path".
 */
export function runAccuracySweep(
  fixture: EvalFixture,
  config: SuggestionConfig = DEFAULT_SUGGESTION_CONFIG,
): SweepReport {
  const { manifest, sails, polars, limits } = fixture;
  const { twaMin, twaMax, twaStep, twsValues } = manifest.sweep;

  const conditions: ConditionOutcome[] = [];
  const skipped: { twa: number; tws: number }[] = [];
  let bilinearServed = 0;
  let totalSailEvaluations = 0;

  for (let twa = twaMin; twa <= twaMax; twa += twaStep) {
    for (const tws of twsValues) {
      const expected = strictExpectedWinner(manifest, twa, tws);
      if (expected === null) {
        skipped.push({ twa, tws });
        continue;
      }
      const acceptable = acceptableLeaders(manifest, twa, tws);

      const result = suggestSails(twa, tws, sails, polars, limits, config);
      const leader = result.evaluations[0]?.sail.name ?? null;
      const suggested = result.suggested.map(e => e.sail.name);

      conditions.push({
        twa,
        tws,
        expected,
        acceptable,
        leader,
        suggested,
        wrongLeaderStrict: leader !== expected,
        wrongLeaderAdjusted: leader === null || !acceptable.includes(leader),
        expectedAbsentAdjusted: !suggested.some(name =>
          acceptable.includes(name),
        ),
      });

      for (const sail of sails) {
        totalSailEvaluations++;
        const bilinear = estimateSailSpeed(
          { tws, twa },
          polars.get(sail.id) ?? [],
          { ...config.interpolation, strategy: 'bilinear' },
        );
        if (bilinear.pointsUsed.length > 0) bilinearServed++;
      }
    }
  }

  return {
    fixture: manifest.name,
    conditions,
    skipped,
    wrongLeaderStrict: conditions.filter(c => c.wrongLeaderStrict).length,
    wrongLeaderAdjusted: conditions.filter(c => c.wrongLeaderAdjusted).length,
    expectedAbsentAdjusted: conditions.filter(c => c.expectedAbsentAdjusted)
      .length,
    bilinearServed,
    totalSailEvaluations,
  };
}

// --- Reporting ----------------------------------------------------------------

function pct(count: number, total: number): string {
  return total === 0 ? '—' : `${((100 * count) / total).toFixed(1)} %`;
}

function ratio(count: number, total: number): string {
  return `${count}/${total} (${pct(count, total)})`;
}

const MAX_FAILURE_LINES = 40;

/**
 * Formats a sweep report for the console: the summary metrics, a per-condition
 * failure map (rows = TWA, cols = TWS), and the first failures in detail.
 *
 * Map legend: `.` correct, `L` wrong leader, `M` expected absent from the
 * suggested list, `B` both, `·` skipped (coverage gap).
 */
export function formatSweepReport(report: SweepReport): string {
  const scored = report.conditions.length;
  const lines: string[] = [
    `=== Fixture: ${report.fixture} ===`,
    `Conditions: ${scored} scored, ${report.skipped.length} skipped (coverage gap)`,
    `Wrong leader (D3-adjusted):  ${ratio(report.wrongLeaderAdjusted, scored)}` +
      `   [strict: ${ratio(report.wrongLeaderStrict, scored)}]`,
    `Expected absent from list (D3-adjusted): ${ratio(report.expectedAbsentAdjusted, scored)}`,
    `Bilinear-served sail evaluations: ${ratio(report.bilinearServed, report.totalSailEvaluations)}`,
    '',
  ];

  // Failure map.
  const byKey = new Map(report.conditions.map(c => [`${c.twa}/${c.tws}`, c]));
  const twaValues = [...new Set([...report.conditions, ...report.skipped].map(c => c.twa))].sort(
    (a, b) => a - b,
  );
  const twsValues = [...new Set([...report.conditions, ...report.skipped].map(c => c.tws))].sort(
    (a, b) => a - b,
  );
  lines.push(
    'Failure map (.=ok, L=wrong leader, M=expected absent, B=both, ·=skipped):',
  );
  lines.push(`  TWA\\TWS ${twsValues.map(t => String(t).padStart(3)).join('')}`);
  for (const twa of twaValues) {
    const cells = twsValues.map(tws => {
      const c = byKey.get(`${twa}/${tws}`);
      if (!c) return '·';
      if (c.wrongLeaderAdjusted && c.expectedAbsentAdjusted) return 'B';
      if (c.wrongLeaderAdjusted) return 'L';
      if (c.expectedAbsentAdjusted) return 'M';
      return '.';
    });
    lines.push(`  ${String(twa).padStart(5)}°  ${cells.map(c => c.padStart(3)).join('')}`);
  }
  lines.push('');

  // Failure detail.
  const failures = report.conditions.filter(
    c => c.wrongLeaderAdjusted || c.expectedAbsentAdjusted,
  );
  if (failures.length > 0) {
    lines.push('Failures:');
    for (const f of failures.slice(0, MAX_FAILURE_LINES)) {
      lines.push(
        `  TWA ${f.twa}° @ ${f.tws} kn — expected ${f.expected}` +
          ` (accept: ${f.acceptable.join(', ')}), leader ${f.leader ?? '—'},` +
          ` suggested [${f.suggested.join(', ')}]`,
      );
    }
    if (failures.length > MAX_FAILURE_LINES) {
      lines.push(`  … +${failures.length - MAX_FAILURE_LINES} more`);
    }
  }

  return lines.join('\n');
}
