# Testing

Tests run on **Jest** via the `jest-expo` preset.

## Running

```bash
npm test        # jest --watchAll (development default)
npx jest        # run once (CI-style)
npx jest path/to/file.test.ts   # a single file

npm run eval:suggestions   # opt-in: sail-suggestion accuracy sweep (see below)
```

Preset is set in [`package.json`](../package.json) (`"jest": { "preset":
"jest-expo" }`).

## What's tested

Testing here focuses on **pure domain logic** — the math and pipelines that are
easy to get subtly wrong — not UI rendering. Existing suites:

| Area                 | Tests                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| Bearing / TWA        | `features/coordinate/util/__tests__/bearing-test.ts`                     |
| Polar interpolation  | `features/sailPolar/util/__tests__/interpolation.test.ts`                |
| Sail suggestion      | `features/sailSuggestion/util/__tests__/` (`suggestSails`, `evaluateSail`, `rankSails`, `limitScoring`) |
| Suggestion guards    | `features/sailSuggestion/util/guards/__tests__/symmetryGuard.test.ts`    |

## The real-race fixture

`features/capture/util/__tests__/fixtures/saturday-race.log` is a real 2 h 15 m
race off the boat's own Zeus 3, with its course and the sailed truth beside it in
`saturday-race.manifest.json`. `saturdayRaceReplay.test.ts` replays the whole
capture pipeline over it in under 4 seconds, which is how leg-detection defects
get diagnosed without rebuilding an APK.

Since ticket `22` it asserts the **truth**, not a recorded defect:
`detectsTheSailedLegs` expects the manifest's 7 legs with their names and
boundary times, so a regression in course-anchored detection fails on the real
race rather than on a synthetic one. `grounds the manifest truth in the track`
re-derives the truth from the log on every run, so the fixture cannot drift; if
that test breaks, replay broke, not detection.

One gotcha it exists to hide: a log the app recorded carries **no arrival times**
— the recorder writes the plotter's bytes through untouched, unlike `nmea-sim`'s
tagged logs. Replay it through `rawLogReplayInput` (`features/capture/util/rawLogReplay.ts`),
which reconstructs timing from the GPS clock. Feeding a real log straight to
`replayCaptureSession` with `assumedSentencePeriodMs` silently stretches the
recording several times over and makes every duration meaningless.

## Opt-in evaluation suites (`*.eval.ts`)

Alongside the default suites there is an **opt-in accuracy sweep** for the
sail-suggestion engine: `features/sailSuggestion/eval/accuracy.eval.ts` runs
the real `suggestSails` pipeline over the fixture datasets in
`polars/fixtures/` and ratchets the scores against a locked baseline. The
`.eval.ts` suffix matches no default `testMatch` pattern, so `npx jest` never
runs it; `npm run eval:suggestions` selects it via
[`jest.eval.config.js`](../jest.eval.config.js). Its pure ground-truth logic
is still unit-tested in the default run
(`features/sailSuggestion/eval/__tests__/fixture.test.ts`). Design and usage:
[`docs/sail-suggestion/package-e-eval-harness.md`](./sail-suggestion/package-e-eval-harness.md).

## Conventions

- **Location:** co-locate tests in a `__tests__/` folder next to the code under
  test, inside the feature's `util/` (or `guards/`) directory.
- **Naming:** `*.test.ts` (a couple of legacy files use `*-test.ts` — prefer
  `.test.ts` for new tests).
- **Test pure functions.** The `util/` layer is deliberately free of React and DB
  access, so tests are plain input→output with no mocking of Expo/SQLite.
- **Build fixtures with small factory helpers.** Suggestion tests use local
  `makeSail` / `makeEvaluation` builders with `Partial<T>` overrides rather than
  repeating full objects — mirror that when a type has many fields:
  ```ts
  function makeSail(id: number, name: string): Sail { /* sensible defaults */ }
  function makeEvaluation(o: Partial<SailEvaluation> & { sail: Sail }): SailEvaluation {
    return { /* defaults */, ...o };
  }
  ```
- **Prefer to keep new logic testable:** put non-trivial math/decision logic in a
  pure `util/` function (as the codebase already does) so it can be unit-tested
  without a device or emulator.

## What isn't covered

- No component/render tests, no end-to-end tests. UI and integration are verified
  by running the app on a device/emulator — there's no headless way to prove a
  screen works. When you change UI, say what you actually verified rather than
  implying automated coverage.
