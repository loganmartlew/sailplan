# Package I — Sail usable range (wind-speed range + unified limits UI)

> Round-3 package, designed in a July 2026 grilling session on per-boat scoring
> configuration. Adds the one fact the domain model cannot currently express —
> *"this sail is not used at all outside this wind-speed range"* — and reworks
> the limits UI so the wind range and the existing per-TWS TWA windows read and
> edit as a single "when do we use this sail" surface. Status: **done**.

## The problem it fixes

Sailors hold boat-specific knowledge the engine can't currently be told. The
motivating examples (a modified Mumm 36):

- *"S1 is only carried above ~170° in more breeze"* — **already expressible**:
  `sailTwaLimit` rows interpolate the TWA window across TWS. No change needed.
- *"In more than ~18 kt we might not use S1 at all"* — **not expressible**.
  `interpolateTwaLimits` clamps outside the defined TWS range, so every sail is
  assumed to have *some* usable window at every wind speed. The window can
  narrow with breeze but never close.
- *"Which of S1.5 / A2 is better depends on the day (wind, crew)"* — needs no
  modelling: with overlapping limits the two score within the selection margin
  and both surface; the day call stays human.

Polar data alone can't fill this gap on realistic timescales — a boat may use
1–2 sails a race and go months without hoisting a given sail — which is
exactly why the engine already treats user-asserted limits as a first-class
knowledge channel. This package extends that channel with the missing axis.

## Design decisions (with rejected alternatives)

- **D4 — Structured domain fields, not engine tuning.** Boat knowledge enters
  as numeric facts about sails (forms, deterministic consumption), in the same
  pattern as `sailTwaLimit`. `SuggestionConfig` stays internal.
  *Rejected:* exposing per-boat overrides of blend/trapezoid/guard constants —
  every boat becomes an untestable config snowflake and the Package E harness
  only validates the defaults. (A hidden dev-only tuning screen remains a cheap
  future option; `suggestSails` already accepts a config override.)
- **D5 — Wind range is a new per-sail fact, not a limits-table extension.**
  Nullable `minTws` / `maxTws` on `sail`. The limits table answers *"at this
  wind speed, which angles?"*; the wind range answers *"is this wind speed on
  the table at all?"* — different axes that compose.
  *Rejected:* encoding "retired above 18 kt" as a degenerate collapsing TWA
  window — asks the user to express intent as a geometric hack and complicates
  `interpolateTwaLimits` for every sail.
- **D6 — Soft taper, not a hard veto.** "~18 kt" is a judgment with a fuzzy
  boundary. Out-of-range sails take a penalty that grows with TWS excess, stay
  visible in the breakdown, and can still be the flagged `isFallback` pick —
  consistent with the trapezoid's outside-floor philosophy. A hard veto would
  make a sail vanish at 18.2 kt with no trace and could yield zero suggestions.
- **D7 — No boat-level symmetry crossover field.** Per-sail TWA limits already
  encode the crossover sail-by-sail, and `symmetryGuard` defers to explicit
  limits (`skipWhenLimitsDefined`). A boat field would duplicate the fact and
  need a precedence rule.
- **D8 — No crew/day modelling.** No per-sail demand rating, no plan-time crew
  input. Overlap coverage comes from the existing additive selection margin.
- **D9 — No "limits enabled" toggle and no zero-data semantics change.**
  Current behaviour already matches intent: no limits + no polars → excluded
  from suggestions but visible in the breakdown; polars without limits → the
  normal blend (coverage envelope standing in). A toggle would store a state
  the engine treats identically to blank.

## What it ships

### 1. Schema — wind range on `sail`

Nullable `minTws` / `maxTws` (knots, real) on the `sail` table + Drizzle
migration. Free numeric values — **not** snapped to the `TWS_VALUES` 5-kt grid
(18 kt must be expressible). Model + Zod schema updated in
`features/sail/model/sail.ts` per the models-mirror-DB convention.

### 2. Engine — `windRangeGuard`

New guard in the existing registry (the registry was built for this):

- Inside `[minTws, maxTws]` (either side nullable → unbounded): no penalty.
- Outside: penalty ramping linearly with TWS excess over a taper width, capped
  at a max penalty large enough to rank any out-of-range sail below any
  in-range one, but finite — fallback selection stays possible.
- Constants live in a new `windRangeGuard` block in
  `DEFAULT_SUGGESTION_CONFIG` (taper width, penalty slope/cap); tuned against
  a new eval-harness scenario, so exact defaults are an implementation-time
  call, not a design commitment.
- Guard result carries a reason string so the breakdown dialog explains the
  penalty ("above sail's wind range (18 kt)") for free via the existing guard
  rendering.

### 3. UI — unified "usable range" editing (evolved limits screen)

`app/sails/[sailId]/twa-limits.tsx` grows a **wind range** min/max control
(stepper pair, free numeric) above the existing per-TWS rows. TWS rows outside
the entered range render greyed out / disabled with a "not used" label —
the relationship between the two datasets is taught by the interaction.
Semantics preserved: a blank min/max row *inside* the range still means "no
angle restriction at this wind speed" — blank ≠ not-used.

### 4. UI — per-sail envelope chart (read-only)

A read-only TWS × TWA chart of **one sail's** usable envelope — its TWA
windows per wind speed, clipped to its wind range — rendered with
victory-native in the sail's colour, shown on the sail detail page
(replacing or augmenting the text-based `TwaLimitsPreviewCard`). It
visualises exactly what the limits screen edits. Explicitly out of scope:
graphical *editing* (drag interactions are a project of their own) and any
boat-level multi-sail overlay.

## Verification

- Unit tests: `windRangeGuard` (inside / taper / cap / one-sided / null),
  config threading.
- Eval harness: new scenario exercising a sail with a wind ceiling — in-range
  ranking unchanged, out-of-range sail ranks below all in-range sails, still
  selectable as fallback when nothing is in range.
- Deferred scenario (when real polar data starts accumulating): proven-sail vs
  new-limits-only-sail with overlapping windows — confirm both still surface
  within the selection margin. Not a gate for this package; today's all-limits
  data makes it moot by construction.
- Round-1 scenario table and round-2 ratchets stay green (sails without a wind
  range are untouched — the guard no-ops on null/null).

## Files (planned)

- `schema.ts` + generated migration — `minTws` / `maxTws` columns.
- `features/sail/model/sail.ts` — type + Zod updates.
- `features/sailSuggestion/util/guards/windRangeGuard.ts` — new guard.
- `features/sailSuggestion/util/guards/guardRegistry.ts` — registration.
- `features/sailSuggestion/model/suggestionConfig.ts` — `windRangeGuard` block.
- `app/sails/[sailId]/twa-limits.tsx` — wind-range control + row grey-out.
- `features/sailTwaLimit/components/` — envelope chart component (new) +
  `TwaLimitsPreviewCard` integration.
- Tests: guard unit tests, eval scenario, limits-screen behaviour.
