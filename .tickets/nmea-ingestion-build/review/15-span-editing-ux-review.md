# 15 — Span editing: UX review

Reviewed 17 August 2026 against `SailSpanEditor.tsx`, `spanEditing.ts`,
`SailedLegReviewPager.tsx`, the round-5 prototype
[`10-review-leg-spans.html`](../../nmea-ingestion/prototypes/10-review-leg-spans.html),
and a live ASUS AI2302 sitting on a 9:19 sailed leg.

**Decisions from the 17 August grilling are at the [end of this
document](#decisions-17-august-2026) and supersede the body where they
disagree.** Three of the body's recommendations were wrong against `spec.md`
§8 and are withdrawn there.

## The one-sentence diagnosis

The prototype's band was a **legend for a trace** — it sat under a speed/TWA plot
on the same time axis, so a divider had something to be aligned *to*. Shipped,
the trace is gone and the band stands alone, so it is an abstract bar with no
referent: nothing on screen tells the sailor where the wind hole was, which
means nothing tells them where to put a divider. Every other complaint below is
downstream of that, or is a rendering/coordinate bug.

---

## P0 — Defects, not taste

### 1. Drag moves the divider to the wrong place

`timeAt()` uses `event.nativeEvent.locationX`, which on Android is relative to
the **view that received the touch** — one of the child block `Pressable`s — not
to the band. Every position is therefore offset by the left edge of whichever
block your finger happened to land on. Confirmed on device: releasing at 57% of
the band left the divider at 61%.

Two consequences the report of "buggy" is made of: the grab picks the wrong
divider (`findNearestDivider` is fed a bogus time), and the divider does not
track the finger.

**Fix:** capture the band's page-space origin (`onLayout` + `measureInWindow`, or
a `ref`) and compute from `pageX - bandOriginX`. `locationX` is only safe when
the responder view is also the touch target, which it is not here.

Related: `onMoveShouldSetResponderCapture` grabs on the first move pixel, so a
vertical scroll that starts on the band is stolen and becomes a divider drag.
Require a horizontal-dominant movement past ~8 px before claiming the responder.

### 2. The editor invents an error on a leg nobody has touched

`LEG_TAIL_GUARD_MS` is 10 s, and `MIN_SPAN_DURATION_MS` is 15 s. Every freshly
drafted leg is therefore born with a block that is illegal by the editor's own
rule, and the first thing the sailor sees is red text: *"Block 3 is too short to
hold a 15 second polar bin."* On a leg they have not edited. That trains people
to ignore the warning.

There are two bugs stacked here:

- **The guard is shorter than the minimum.** Raise the tail guard to ≥15 s (30 s
  head / 20 s tail would match how long a drop actually takes), or let guards be
  exempt.
- **More importantly, the check is applied to `sailId === null` blocks.** A "not
  used" block *should* be short — a 6 s trim off a hoist is the feature working.
  Only a block **carrying a sail** can fail to contribute a point. Gate
  `canSpanHoldBin` on `span.sailId !== null` and the warning disappears from
  every untouched leg while still firing where it means something.

### 3. "Delete divider" is two different operations wearing one label

`removeSpan` merges into the *previous* block — except at index 0, where it
merges into the *next* one. Same button, same word, opposite result, and the
label names a divider while the selection names a block, so which of the two
dividers bounding the block is going is left to the reader.

The prototype was unambiguous: **"merge into previous"**, disabled on block 1.
Take that wording back. The universal-undo story in the ticket ("deleting a
divider merges the blocks back") survives intact — it just needs to say *which*
divider in the button.

---

## P1 — The band

### 4. Give the band a trace to sit under

This is the big one. Add a compact (~90 px) speed-over-time trace directly above
the band on the identical time axis, with `sailId === null` regions shaded, as
the prototype did. `useSailedLegReview` already returns the samples,
`react-native-svg` is already a dependency, and `features/sailPolar/ScatterChart.tsx`
is the precedent for how we draw.

Note this is *not* what ticket `16` builds. `16` is a spatial map — it answers
"which leg is this on the water". The trace answers "**when** in this leg did the
boat go stupid", which is the only question a divider can be an answer to. They
are complements; the prototype carried both.

### 5. Three overlapping border systems fight each other

Currently a block draws: `border-r border-background/40` (its own right edge), an
absolutely-positioned 4 px `bg-foreground` bar per divider, and — when selected —
an inset `border-2 border-foreground`. The absolute bars are positioned by
percentage while the blocks are laid out by flex, so they land near but not on
the seams; the selected block's square border overhangs the band's `rounded-xl`
clip at the ends. That is the "borders are a bit weird" report, exactly.

**Pick one.** Suggested: drop the per-block `border-r` and the absolute bars;
render dividers as the seam between blocks by giving the band a small `gap`, and
show selection as a ring drawn *outside* the band's clip (or as a 3 px underline
beneath the selected block) so it never collides with the rounded corners.

### 6. Slivers: keep them selectable, make them hittable

Selectable is right — a "not used" block is exactly what you tap to give it a
sail, so making them inert would break the ticket's "one act" model. The problem
is that `flex: duration` gives a 10 s block out of 9:19 about 6 px, which is
neither tappable nor readable, and its label degrades to `..`.

Three changes, all cheap:

- **Floor the rendered width.** `flex` with a `minWidth` of ~28 px, so the band
  is a slightly non-linear but always usable map of the leg. Truth stays in the
  numbers in the card below.
- **Drop the in-block label when it does not fit.** The prototype only drew text
  above 26 px and otherwise showed nothing — silence beats `..`. The selected
  block's identity is already stated in full in the card underneath.
- **Add a block strip below the band**: `[1 ·05s] [2 · J1 9:04] [3 ·10s]` as a
  segmented row. This becomes the reliable selection surface at any zoom, and
  the band becomes purely a picture. It also gives the multi-block case a place
  to show durations without tapping through each one.

### 7. Nothing shows you what is draggable

The prototype drew a grab circle on each divider. We draw a flat bar and a line
of prose. Put a visible handle (a pill, ~20 × 28 px) on each divider, centred
vertically, and enlarge its hit slop well past its drawn size. With #1 fixed and
handles present, drag becomes worth keeping — coarse placement by drag,
precision by nudge, which is the division of labour the ticket asks for.

*If handles are more than you want right now:* disabling drag is survivable —
split + nudge covers every edit — but it would give up an acceptance criterion,
and #1 alone is a small fix. I would fix, not disable.

---

## P2 — The control card

### 8. The sail row should be the stamp sheet

Nine outline pills with tiny colour dots, wrapping raggedly, sharing their exact
visual weight with the `−15s`/`+5s` buttons directly beneath them, and growing
without limit as the locker grows. Meanwhile `SailStampSheet` in
`CaptureRecordingBar.tsx` already solves this problem for the same domain object:
a modal of two-column colour-filled tiles, thumb-sized, unmistakable.

**Reuse it.** The card shows one full-width control reading
`Sail · [swatch] Big red` (or `Not used`), tapping opens the sheet, the sheet
carries a `Not used` entry at the top. One tap to open, one to choose, and the
card collapses from three ragged rows to one line. Lift the sheet out of
`CaptureRecordingBar.tsx` into a shared component with the heading and subtitle
as props — stamping says "this instant only", attribution says "this block".

### 9. Start/End in the middle — agreed

`−15s −5s [Start] +5s +15s` reads as an axis with the label at zero, kills the
dead left gutter, and makes the symmetry obvious at a glance. Do the same for
End. Worth doing on both rows or neither.

While there: when a row is disabled (block 1's start, the last block's end) it is
currently four dead buttons with no reason given. The prototype replaced them
with the words **"leg start"** / **"leg end"**. Do that — it explains the
boundary instead of just refusing.

### 10. Say what split will do

`Split block` is disabled below 30 s with the explanation only appearing when
disabled. Fine. But add where the cut lands — the midpoint — to the label or a
line of hint text, because right now the block silently becomes two and the
selection jumps to the second half with no indication that is what happened.

### 11. Multi-part legs stack two full editors

When a leg has a data gap, `SailedLegReviewPager` renders one complete
`SailSpanEditor` per part — two bands, two 200 px control cards, one small
"Continued after data gap" line between them. Both cards carry their own
selection, so "Block 2 of 3" appears twice on screen meaning different things.

Cheapest fix that holds: hoist selection to the pager so exactly one block is
selected across the whole leg, render all parts' bands stacked (they share the
axis anyway), and render **one** control card below, for whichever block is
selected. The parts stay honest in the data; the sailor sees one leg.

### 12. Two "not used" mechanisms in one screen

The leg header carries a `Used`/`Not used` toggle, and every block carries a
`Not used` sail. On the leg I looked at, the header said "Not used" and all
three blocks said "Not used", which reads like the same fact stated four times —
and it is unclear whether flipping the header would clear the blocks' sails.

The spec's model is that null sail *is* "not used" and needs no other
representation. Either derive the header state from the spans (a leg is used iff
any block carries a sail — the pager already half does this in `setUsed`) and
make it a read-only summary, or drop it. A second control for a state the first
one already determines is the thing this ticket exists to remove.

---

## Suggested order

1. #1 drag coordinates, #2 phantom error, #3 merge label — bugs, small, land first.
2. #5 borders, #6 sliver hittability + block strip — the band stops looking broken.
3. #8 stamp sheet, #9 centred nudge labels — the card stops looking like a form.
4. #4 the trace — the largest, and the one that makes the feature make sense.
5. #11, #12 — structural tidy-ups, safe to defer.

1–3 are a day's work and address everything in the original complaint. #4 is the
one that changes it from "usable" to "worth using".

---

# Decisions (17 August 2026)

Settled with Logan. Where these disagree with the body above, these win.

## Withdrawn from the body

- **Raising the 25 s / 10 s guards — dropped.** `spec.md` §8 makes them
  load-bearing and welds the tail trim to leg-detection error: *"they are one
  decision; retune them together or not at all"*, with 0/20 vs 16/20 on
  mixed-sail legs behind it. The guards stay. Only the warning changes.
- **Dropping the leg `Used` toggle — dropped.** Story 58 specifies it, and its
  purpose is gating **promotion**, whose point count (ticket `18`) is the
  consequence it is supposed to sit beside. Out of scope here entirely.
- **The trace is an addition, not a restoration.** §8 specifies the map and
  nothing else on the time axis. It is in scope anyway (below), but it is new
  design, so `spec.md` §8 wants a line about it.

## Vocabulary

Captured in [`CONTEXT.md`](../../../CONTEXT.md). Two concepts were sharing the
words "not used", which is why the toggle and the blocks read as duplicates:

| Term | Level | Meaning |
| ---- | ----- | ------- |
| **No sail** | span | Block with null `sailId`. Nothing was flying; feeds no point. **Being short is what a trim is, not a fault.** Replaces the prototype's "Cut" and the current "Not used" label on blocks. |
| **Not used** | sailed leg | The sailor's judgement that the leg should not feed promotion. **Leaves every span's sail intact.** Ticket `18`. |
| **Block** | — | A span, as spoken of in review. A leg is a row of blocks. |
| **Divider** | — | The boundary between adjacent blocks. Moving one is the single act; deleting one merges and is the universal undo. |

## What gets built

### 1. The trace — first, before band work

~90 px `stw` line above the band on the identical time axis (spec line 440:
`stw` **is** the polar's speed). No-sail regions shaded, divider lines carried up
through the plot — the prototype's `traceAndBand` exactly. `react-native-svg` is
already a dependency; `features/sailPolar/ScatterChart.tsx` is the precedent.

Built first because the band is laid out *under* it, and doing the band first
means laying it out twice.

Not TWS, and not the steadiness mask — the mask belongs to `18` and does not
exist yet.

### 2. The band is a picture; the strip is the control

The band is **strictly linear in time** and never a selection target. This is
forced by the trace: a minimum block width would put a divider somewhere other
than under the dip that justifies it, which is most of the trace's value.

- **Band** — colour only, drag only. Blocks below the width that fits text draw
  no label (never `..`). Visible handles on each divider, ~20 × 28 px, with hit
  slop well past their drawn size. Nearest-divider semantics stay, per §8.
- **Strip** — a segmented row beneath the band, `1 · 25s | 2 · J1 9:04 | 3 · 10s`,
  is the **only** selection surface. Every block gets a full-size tap however
  short it is, and durations become visible without tapping through each block.

Separating the two also kills the tap/drag contention on one surface, which is
part of why drag feels unreliable.

### 3. Drag coordinates — the actual bug

`timeAt()` uses `nativeEvent.locationX`, which on Android is relative to the
child `Pressable` that received the touch, not the band, so every position is
offset by that block's left edge. Measured on device: released at 57 % of the
band, divider landed at 61 %. Use `pageX` minus the band's measured page-space
origin.

Also require horizontal-dominant movement past ~8 px before claiming the
responder — `onMoveShouldSetResponderCapture` currently steals a vertical scroll
that starts on the band.

### 4. The "too short" warning fires only for blocks carrying a sail

`canSpanHoldBin` gated on `sailId !== null`. A no-sail block is *expected* to be
short; only a block you assigned a sail to can disappoint you by contributing
nothing — which is §8's stated intent (*"rather than being carefully trimmed and
silently contributing nothing"*). With the guards staying at 25 s / 10 s, this is
what stops every untouched leg opening in red.

### 5. Merge becomes two directional buttons

**Merge left** / **Merge right**, each disabled at its end. §8 requires *every*
block to be removable — which is why the current index-0 special case exists, and
why the prototype's single "merge into previous" would leave block 1 as the one
block you cannot delete. Two buttons are never ambiguous, and the sailor chooses
which neighbour absorbs the time instead of having it chosen for them.

### 6. Sail assignment moves to the stamp sheet

Lift `SailStampSheet` out of `CaptureRecordingBar.tsx` into a shared component,
heading and subtitle as props (stamping says "this instant only"; attribution
says "this block"). The card's sail row becomes:

```
[ ● Big red  ▾ ]   [ No sail ]
```

`No sail` stays **inline, not in the sheet** — clearing a block is the commonest
edit in the feature (every trim and every cut) and must not cost a modal open.

### 7. Nudge rows: label in the middle

`−15s  −5s  [Start]  +5s  +15s`, same for End. Reads as an axis with the label at
zero and kills the dead left gutter. When a row is disabled (block 1's start, the
last block's end) replace the four dead buttons with **"leg start"** / **"leg
end"** — explain the boundary rather than just refusing.

### 8. Split says where it cuts

Add the midpoint to the label or hint text. Currently the block silently becomes
two and selection jumps to the second half with no indication that is what
happened.

### 9. One editor per leg, gap included

A leg split by a data gap renders **one** trace, band, strip and card across the
whole leg — a sailor seeing the same leg twice, each half asking to be assigned
separately, is the confusion to avoid.

The gap is a **fixed "No data" block**: hatched or dimmed, unselectable,
unmovable, unsplittable, and never merged through. So it is a permanent divider,
and serialising the unified band back into per-`sailedLeg` span lists on confirm
is just splitting at the gap. A block's stated duration then never includes time
no data covers.

### 10. Borders — pick one system

Currently three fight: per-block `border-r`, percentage-positioned absolute
divider bars over flex-sized blocks, and an inset `border-2` selection ring that
overhangs the band's `rounded-xl` clip. With selection moving to the strip
(§2), the band keeps only the divider handles, and selection is shown on the
strip segment.

## Deferred to ticket `18`

- The leg `Used` / `Not used` toggle, its point count, and its display.
- **Known defect shipped in the meantime:** `confirmSailedLegPresentation` writes
  `sailId: used ? span.sailId : null`, so toggling a leg to not-used **silently
  and irreversibly erases every sail assignment on it at confirm time**.
  `sailedLeg` has no `used` column — "used" is derived purely from whether any
  span carries a sail, so the toggle is a lossy write onto a derived state.
  `18` should add the flag (spans untouched, promotion reads it) and delete that
  expression. Recorded here so it is not rediscovered as a mystery.

## Order

1. Trace (§1) — everything is laid out under it.
2. Band + strip (§2), drag fix (§3), borders (§10).
3. Warning gating (§4), merge buttons (§5) — small, independent.
4. Sail sheet (§6), nudge labels (§7), split hint (§8).
5. Unified split-leg editor (§9).
