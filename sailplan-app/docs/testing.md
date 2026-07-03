# Testing

Tests run on **Jest** via the `jest-expo` preset.

## Running

```bash
npm test        # jest --watchAll (development default)
npx jest        # run once (CI-style)
npx jest path/to/file.test.ts   # a single file
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
