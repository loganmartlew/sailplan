# Define how alternates and the existing suggestion breakdown coexist

Type: grilling
Status: resolved
Blocked by: 03

## Question

On the leg-details screen, the accepted design (issue 03) adds a TWA band and
one case card per shift scenario above `SuggestionBreakdown`, which still ranks
every evaluated sail at the central TWA only and hides its raw breakdown behind
a `Details` toggle. Should the case cards sit above an untouched breakdown,
replace its head with the ranked list demoted behind `Details`, or dissolve
into `SailEvaluationCard` as a per-sail "wins from 130°–145°" annotation — and
what does the chosen shape require of the per-sail evaluation data?

## Note

The technical half of this is settled by
[Define the range-aware suggestion and navigation contract](04-define-range-aware-technical-contract.md):
`RangeSailSuggestionResult` embeds `central: SailSuggestionResult` verbatim, so
`SuggestionBreakdown` keeps its current prop whichever layout wins, and each
`RangeAlternate` already carries the `twaInterval` a per-sail "wins from
130°–145°" annotation would need. The remaining question is purely
presentational.

## Answer

The case cards sit **above an untouched `SuggestionBreakdown`**, and the
per-sail annotation is added as well rather than instead. The case cards are
the recommendation; the ranked list below is the evidence for it; a muted line
on each alternate's `SailEvaluationCard` ties the two together. Rejected:
demoting the ranked list behind `Details` (that control expands the raw rows
*inside* each card at `SuggestionBreakdown.tsx:65` and does not hide the list —
reusing it would give one control two meanings, and it would hide the evidence
that justifies the alternate); and the annotation *alone* (an alternate wins at
a TWA away from centre, so it can rank low in the central-TWA list, putting the
annotation where nobody looks, with nowhere for the trigger reason to go). Also
rejected: making the ranked list itself range-aware, which would reopen issue
04's `central: SailSuggestionResult` contract.

Throughout, the worked example is central TWD `215°`, half-spread `15°`, so a
possible TWD range of `200°–230°`.

### Screen order

Inside the existing `Sail Suggestions` section (`app/(plan)/course/leg.tsx:96-105`):

1. The TWA band, in the existing TWA/bearing card (issue 03, unchanged here).
2. The case cards.
3. `SuggestionBreakdown`, unchanged apart from its conditions line.

When `twdSpread` is `0` the screen is byte-for-byte today's: no case cards, no
second heading, no annotations, no conditions-line qualifier.

### Case cards

Stacked vertically in the fixed order **`Left shift` / `Expected` /
`Right shift`**, where a left shift backs the wind (lower TWD) and a right
shift veers it (higher TWD). This matches the `←`/`→` convention issue 03 set
on the `CourseLegCard` badge row. The Expected card is dominant through
styling, not position — position ordering would otherwise flip with the number
of qualifying alternates.

**Side by side was measured and rejected.** `leg.tsx:59` uses `px-3`, so a
390pt phone gives 366pt; three columns at `gap-2` with `p-4` card padding leave
roughly 92pt of text width, about 13 characters per line at `text-sm`. The
ranges fit; the reasons do not (`Code 0 below its 85° minimum TWA` is 32
characters). Issue 03 gave the cards the "numbers and reasons" job and the band
the "shape" job, so a layout that squeezes the reason out makes the cards a
worse band. Corroborating: the app has no three-column row anywhere — its
ceiling is two (`leg.tsx:75`, `CourseLegCard.tsx:170`) — and no tablet flag, no
`useWindowDimensions`, and no horizontal `ScrollView`.

Each alternate card is headed by that alternate's **qualifying** `twdInterval`
from issue 04 — the contiguous stretch where it actually wins, which by
construction excludes the central TWD — e.g. `200° – 207°`, never `200° – 215°`.

### The Expected card shows a point, never a range

`Expected 215°`, not `Expected 207° – 230°`.

The residual range is the tempting answer, because "how much of my uncertainty
is safe?" is the question a planner actually has. It cannot be answered from
this data. Issue 01 surfaces a challenger only when it wins across an interval
of at least `max(5°, 20% of 2s)` — here `6°` — so a sail winning from
`210°–214°` is dropped silently. The leftover therefore means **no alternate
qualified here**, which is not the same as **the primary sail wins here**. A
range header would assert the stronger claim, and nothing on screen would let
the user detect the error. `Expected 215°` asserts only what the definition of
the primary sail guarantees.

### When a side has no alternate

State what the rule found, not what the sail does:

- One side qualifies → two cards, plus a muted line on the quiet side:
  `No alternate qualified above 215°`.
- Neither side qualifies → **no cards at all**, one muted line:
  `No alternate qualified across the possible range`. The band and the numeric
  possible interval still render.
- No finite central leader (issue 01) → `central.suggested` is empty and no
  alternate can qualify, so the range section renders nothing and
  `leg.tsx:100-104` behaves exactly as today.

**This overrides issue 03's `No change from the expected sail` wording**, by the
same reasoning as the Expected card above: `no change` claims the primary holds
across a whole side that was never verified.

### The in-list annotation

Each **alternate's** `SailEvaluationCard` gains a muted line carrying its
qualifying `twaInterval` — the folded image of the same stretch — and nothing
else. Not the primary: its stretch is the residue of the other two, which the
Expected-card reasoning above shows is not a claim we can make. Not the trigger
reason: that belongs on the case card, where there is room for a sentence.

Data required: one new optional prop, formatted through `formatAngle` like
every other angle in the component.

```ts
interface SailEvaluationCardProps {
  evaluation: RankedSailEvaluation;
  suggested: boolean;
  showDetails?: boolean;
  /** Where this sail wins, when it is a range-dependent alternate. */
  rangeNote?: { min: number; max: number };
}
```

`SailEvaluationCard` therefore stays a pure display component and never learns
the `RangeAlternate` type, holding issue 04's seam. No change to the evaluation
data itself: everything needed is already on `RangeAlternate`.

### One sail, two predicted speeds

A `RangeAlternate` is evaluated at its interval **midpoint** (issue 04); the
same sail appears in the ranked list evaluated at the **central TWA**. A Code 0
can read `7.2 kn` on its case card and `6.1 kn` in the list below.

Both numbers are shown and neither is reconciled — the disagreement *is* the
feature, since "this sail is better over there" is exactly what it means. Each
is scoped by its own section: the case cards by their sub-range headers, and
the ranked list by its conditions line, which gains a two-word qualifier when
`twdSpread > 0`:

```text
Ranked at TWA 135° · TWS 12 kn · Reaching
```

At `twdSpread: 0` the line is unchanged (`SuggestionBreakdown.tsx:35-39`).

### Headings

When `twdSpread > 0`, the screen carries two headings: the existing
`Sail Suggestions` over the case cards, and a new `All sails` over the
breakdown. This stops the central-TWA ranked list from reading as part of the
recommendation. When uncertainty is off, the single existing
`Sail Suggestions` heading sits directly above the breakdown as it does today —
the second heading is never introduced.

### Out of this ticket

`CourseLegCard`'s `←`/`→` badge row is unchanged. The arrows stay bare: that
row is scanned one-handed and issue 03 forbade growing card height, while leg
details is the teaching surface one tap away. Reopening issue 03's badge row
would need its own ticket.
