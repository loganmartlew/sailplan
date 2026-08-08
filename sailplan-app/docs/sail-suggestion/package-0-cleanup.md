# Package 0 — Cleanup (implementation plan)

> Covers findings **3.2** (debug logging) and the **barrel-import violation**
> from Tier 4 of [`improvements.md`](./improvements.md). Standalone, no design
> decisions, no behaviour change. Safe to ship immediately as one small PR.

## Requirements

1. No `console.log` fires during normal rendering of the course-plan screen.
2. `CourseLegCard` imports the `SailEvaluation` type through the
   `~/features/sailSuggestion` barrel, per the workspace convention
   ("import features through their barrel").
3. Zero behaviour change — no scoring, data, or UI output differs.

## Changes

### 1. Remove the debug log block (3.2)

**File:** `features/plan/components/CourseLegCard.tsx` (lines ~102–115).

The block is a commented-out condition wrapping a *live* `console.log` that
`JSON.stringify`s the full suggestion result — including each evaluation's
`reasoning.pointsUsed` polar arrays — on every render of every card:

```tsx
// if (from.mark.name === '') {
console.log(
  JSON.stringify(
    { from: from.mark.name, to: to.mark.name, twa: twa.angle, suggested },
    null,
    2,
  ),
);
// }
```

Delete the entire block, including the commented-out `if` wrapper lines.
Beyond log noise, the serialisation itself is real per-render work (the
`suggested` evaluations embed `pointsUsed: PolarPoint[]`), so this is a small
perf win too.

### 2. Fix the deep import

**File:** `features/plan/components/CourseLegCard.tsx` (line ~20).

`SailEvaluation` is *already* re-exported from the feature barrel
(`features/sailSuggestion/index.ts`), so no barrel change is needed — only the
import site changes. Merge the deep type import into the existing barrel
import:

```tsx
// Before
import type { SailEvaluation } from '~/features/sailSuggestion/model/sailEvaluation';
// …
import { useSailSuggestions } from '~/features/sailSuggestion';

// After
import {
  useSailSuggestions,
  type SailEvaluation,
} from '~/features/sailSuggestion';
```

> Note: Package A renames the ranked type to `RankedSailEvaluation` (the
> `suggested` array is post-ranking data). Doing this import fix first means A
> only touches the barrel + one import specifier here.

## Verification

- `npm run lint`
- `npx jest`
- `npx tsc --noEmit` (typed routes + strict mode catch a bad import path)

No on-device verification needed; there is no runtime-visible change beyond
the absence of log output.

## Out of scope

Everything else in `CourseLegCard` (the per-card data fetching is Package B;
badge tap-through is Package C).
