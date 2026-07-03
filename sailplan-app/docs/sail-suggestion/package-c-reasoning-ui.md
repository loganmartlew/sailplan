# Package C — Reasoning UI (implementation plan)

> Covers finding **3.3** from [`improvements.md`](./improvements.md),
> including surfacing the fallback-pick flag from finding 2.3.
>
> **Sequenced after Package A** (it displays A's new fields: continuous
> weights, `isFallback`, `RankedSailEvaluation`) and assumes **Package B**
> (the card already holds the full `SailSuggestionResult`). Kept separate from
> A because A is pure-function work verified by tests while this is UI work
> verified on-device. Shipping C immediately after A creates the **on-device
> tuning loop**: every calibration question from A's scenario table becomes
> inspectable on a real course before Package D touches interpolation.

## Problem being solved

The engine computes rich per-sail reasoning — confidence tier, polar/limit
weights, guard penalties with human-readable reasons, `limitsExceeded`,
predicted speed, the points used — and the UI shows only the top sail's name
badge plus "+N more". Users can't see *why* a sail was suggested, and the
developers tuning the engine can't see it either without `console.log`
(cf. finding 3.2).

## Requirements

1. Tapping the suggestion area on a leg card opens a **breakdown view** for
   that leg's conditions.
2. The breakdown lists **every evaluated sail** (not just the suggested ones),
   in rank order, showing per sail:
   - name + colour swatch (reuse the badge treatment from
     `SailSuggestionBadges`, including the light/dark text contrast logic),
   - ranking score and predicted boat speed,
   - polar score with its **weight**, limit score with its **weight**
     (`reasoning.polarWeight` / `reasoning.limitWeight` from A),
   - confidence as the display-only **tier badge** (high / moderate / low)
     plus the raw 0–1 value,
   - each guard's `reason` string and penalty,
   - an **"outside TWA limits"** warning when `limitsExceeded`,
   - a visible **suggested** marker on the sails that made the cut.
3. The leg's conditions header: TWA, TWS, wind zone (all already in
   `result.conditions`).
4. When `result.isFallback` is true, the breakdown (and ideally the badge row
   itself) shows a **"best available — all sails outside preferred range"**
   style marker distinguishing least-bad picks from confident ones.
5. Angles/speeds formatted via `~/lib/format` (`formatAngle` etc.); scores to
   two decimals; no raw floats dumped in the UI.
6. `reasoning.pointsUsed` is **not** rendered (debug-grade data, unbounded
   length) — everything else in the evaluation is.

## Design

### Components (new, inside the feature)

```
features/sailSuggestion/components/
├── SuggestionBreakdownDialog.tsx   dialog shell: conditions header + scrollable list
├── SailEvaluationCard.tsx          one sail's breakdown block
└── ConfidenceTierBadge.tsx         small tier→colour badge (reused by C and future screens)
```

`sailSuggestion` has no `components/` directory yet — create it and re-export
the dialog (and the tier badge) from the feature barrel, following the
feature-slice anatomy in `docs/conventions.md`.

- **Container:** use `Dialog` from `~/components/ui` (there is no bottom-sheet
  primitive in `components/ui`, and `NewSailPolarDialog` on the same card
  already sets the dialog precedent — don't add a sheet dependency for this).
  Content scrolls (`ScrollView`) since a fleet can exceed screen height.
- **Props:** `SuggestionBreakdownDialog({ result: SailSuggestionResult,
  open, onOpenChange })` — pure display; no data fetching inside (Package B
  already delivers `result` to the card). It renders `result.evaluations`
  (already rank-sorted) and marks membership of `result.suggested` by sail id.
- **`SailEvaluationCard`** layout sketch (NativeWind, matches the card style
  already on screen):

  ```
  [swatch] Sail name             [Suggested ✓] [tier badge]
  score 0.94 · predicted 7.3 kn
  polar 0.98 (w 0.83)  ·  limit 1.00 (w 0.17)
  ⚠ Outside TWA limits            (only when limitsExceeded)
  ⚠ Symmetric sail at TWA 140° (−0.10)   (one line per guard result)
  ```

- **Score presentation rule:** weights are shown as computed (they explain the
  blend); do not re-derive or round-trip them from confidence in the UI —
  the engine's `reasoning` is the single source of truth.

### Wiring in `CourseLegCard`

- Make the suggestion row (the `Sailboat` icon + badges area, or the existing
  trailing `MoveRight` icon button — currently a no-op) open the dialog:
  local `useState` for `breakdownOpen`, same pattern as `polarDialogOpen`.
  Prefer wiring the **existing no-op `MoveRight` button** as the explicit
  affordance and making the badge row pressable as a bonus hit target.
- Render `<SuggestionBreakdownDialog result={sailSuggestions} … />` only when
  `sailSuggestions` is non-null.
- When `result.isFallback`, restyle the top badge row: e.g. outline/muted
  badge variant + a small "best available" caption instead of the confident
  solid-colour badge.

### Model / engine changes

None. This package must not touch `util/` or `model/` in `sailSuggestion` —
if a field is missing or awkward to display, that's feedback for A, recorded
in the plan index, not a side-door engine change.

## Testing & verification

- Component snapshot/unit tests only if the repo already tests components
  (current test suites are util-only — follow `docs/testing.md`; don't build
  a render-test harness just for this).
- The formatting helpers, membership marking (`suggested` by id), and
  fallback-flag branch are the fragile bits; if any logic grows beyond JSX,
  extract it to `util/` and unit-test it there.
- On-device pass (this is the point of the package): a course with mixed
  fleet — one dense-polar sail, one limits-only sail, one out-of-limits sail —
  confirming every requirement above renders, in both a confident leg and an
  all-out-of-limits (fallback) leg.
- `npm run lint`, `npx tsc --noEmit`, `npx jest`.

## Files touched

```
features/sailSuggestion/components/SuggestionBreakdownDialog.tsx   NEW
features/sailSuggestion/components/SailEvaluationCard.tsx          NEW
features/sailSuggestion/components/ConfidenceTierBadge.tsx         NEW
features/sailSuggestion/index.ts                                   +component exports
features/plan/components/CourseLegCard.tsx                         open-dialog wiring, fallback styling
features/sailSuggestion/README.md                                  UI section: what the breakdown shows
```

## Out of scope

Editing limits/polars from the breakdown (the "+ Polar" dialog already
exists), persisting any state, surfacing `pointsUsed`, and any tuning-slider
UI for `SuggestionConfig` (possible future work once A's config is
user-adjustable).
