# 10 — The review and promotion screen

Type: prototype
Status: resolved
Blocked by: 05, 12
Map: [map.md](../map.md)

## Question

The after-the-race surface, where a recorded session becomes polar points.
Prototype it.

1. **Seeing the session.** What's the primary view of a few thousand samples —
   a time-series of speed/TWS/TWA, the GPS track on a map (`react-native-maps`
   is already in the app), a polar scatter, or several linked together? What
   makes a two-hour race legible on a phone screen?
2. **Scrubbing and zooming.** How do you navigate two hours of data and select
   a stretch precisely, on a touch screen, with fingers?
3. **Sail assertions in review.** Founding decision 4 makes review the source
   of truth. How are assertions shown on the timeline, corrected, moved,
   deleted, and added where you forgot one during the race?
4. **The proposals.** `07`'s auto-proposed points need to be shown *against
   your existing polar* so you can judge them — the app already has
   `PolarPlotChart` and `ScatterChart`. Proposed versus existing must be
   instantly distinguishable. Do you accept per-point, per-bin, or wholesale?
5. **The manual path.** Founding decision 7 requires hand-selection as a
   fallback. Select a stretch → see its stats → assign a sail → promote. How
   does that flow sit alongside the proposals without becoming a second app?
6. **Reversal.** The provenance column makes promotion undoable. Where does
   "undo this session's contribution" live, and how is it made safe?
7. **Session list.** How do you find a session at all — list by date, with
   what summary? What does an empty or failed session look like?

Rough and throwaway. The point is to react to it, not to ship it. Use `12`'s
simulated data to populate it — this prototype needs a plausible two-hour
session to be judged at all, and waiting for a real one would stall it.

## Prototype

Five rounds. **Judge round 5**:
[`prototypes/10-review-leg-spans.html`](../prototypes/10-review-leg-spans.html).
Open it in a browser; arrow keys page through the legs. All rounds are on branch
`prototype/10-review-screen`.

| Round | Artifact | Verdict |
| --- | --- | --- |
| 1 | in-app expo-router route, 3 variants | superseded by 2 (same designs, wrong medium) |
| 2 | [`10-review-and-promotion.html`](../prototypes/10-review-and-promotion.html) — tape / inbox / polar | **rejected**: "very complex and user unfriendly" |
| 3 | [`10-review-by-leg.html`](../prototypes/10-review-by-leg.html) — leg by leg, 3 variants | **A chosen**; B's map idea folded in, C dropped |
| 4 | [`10-review-by-course-leg.html`](../prototypes/10-review-by-course-leg.html) — one screen per **course** leg | shape accepted, controls too many |
| 5 | [`10-review-leg-spans.html`](../prototypes/10-review-leg-spans.html) — the leg as a row of spans | current |

### Round 5: a leg is a row of spans

The note that *"changing the start/end of each sail could replace the trimming"*
turns out to replace the **mid-leg cuts** as well. Round 4 had three separate
mechanisms — trim the head, trim the tail, cut a section — plus a fourth for
sail changes. They collapse into one:

```
[ not used ][   J1   ][ not used ][   J1   ][ not used ]
  the hoist                a cut                the drop
```

**Every block carries a sail, or nothing.** Trim the start, trim the end, cut
the middle, change sail mid-leg: all the same act. Any number of cuts falls out
for free, and every block is resizable, splittable and removable — which round
4's cuts were not. Drag the band to move the nearest divider, or select a block
and nudge its edges ±5 s / ±15 s; **merge** deletes a divider, which is how a
cut or a sail change is undone.

The map draws **each block in its own colour**, so the cuts and the sail change
are visible on the water rather than only on the trace.

**The review is now per sail and per 10° TWA band** — what this race says, what
your table says, the gap, and how many points fed it. That is a claim a sailor
can argue with ("we were 4 % quick at 40–50°") where a scatter of 231 dots was
not.

**Map focus is a chip on the map itself** (focus leg ⟷ whole course) rather than
a global setting — per glance, not a mode to remember.

#### Two things round 5 raises

- **Defaults now carry all the weight.** Blocks are the only mechanism, so every
  leg opens as *not-used / sail / not-used* using round 4's 25 s and 10 s trims.
  That default is what keeps mixed-sail legs at **0/20**; a default of "one
  block, all used" would leak the ±33 s detection error straight into the
  polars. The default is a real decision, not a cosmetic one.
- **A block under ~15 s cannot hold a bin** (8 samples minimum) and so silently
  contributes nothing. It should say so.
- **Deltas at the edge of a sail's band read as huge.** The review shows A3 at
  +13 % to +24 % against the existing table. That is mostly an artifact of this
  prototype's synthetic "existing" table (fleet × 0.96 with a falloff outside
  each sail's band), but the lesson is real: where your stored table is weakest,
  the comparison invites the most over-reading. Worth a confidence cue.

### Round 4: a leg is mark to mark

The correction that mattered: legs follow the **selected course**, not the
direction the boat happens to be pointing. Nobody wants a screen per tack up a
beat, and a VMG-gybing boat won't judge each gybe. This race's **34 tacks and
gybes now live inside 20 legs** — round 3 would have asked about all 34.

**"Is detection possible if no course is selected?" — yes, and it is measured.**
Segment on median **|TWA|** over a ±90 s window, threshold 25°, minimum leg
180 s, **ignoring the sign**. That is the whole trick: a tack flips TWA's sign
and keeps its magnitude; a rounding changes the magnitude. Sign is *which tack*,
magnitude is *point of sail*, and a course leg is a point of sail.

| | |
| --- | --- |
| roundings found | **14 / 14** |
| spurious boundaries | **0** |
| median timing error | **33 s** |
| legs containing >1 sail, untrimmed | 16 / 20 |
| …after the default trim | **0 / 20**, costing 7 % of the race |

The last two rows matter more than they look: **the end trim is not only for
hoists and drops, it absorbs the detection error.** That is what makes a ±33 s
boundary survivable, and it means trim defaults and detection tolerance are one
decision, not two.

Two rejected approaches, so they aren't retried: segmenting on **heading**
merges nothing (a tack is a 90° heading change, same as a rounding), and
segmenting on **GPS net-travel bearing** scored 14/14 only with 14 spurious
boundaries. Net bearing is still the right backstop for the one case |TWA|
misses — two consecutive legs at the same angle on opposite gybes, e.g. an
out-and-back reach.

**Mark names still need the linked course.** Inferring them from where the boat
rounded was tried and does not hold up: roundings smeared into **4 clusters
where 2 marks exist**. With no course the honest fallback is "Beat 3 / Run 3"
and let the user rename — the harness has a `course: none selected` toggle
showing exactly that.

#### The notes, and what happened to each

| Note | Round 4 |
| --- | --- |
| no way to cut points from the middle of a leg | **✂ cut a section**, drag on the trace; cuts show red and undo from a chip |
| may need several sails at points within a leg | **＋ sail change** splits the leg, split nudges ±15 s, points group by whichever sail was up — the hook for mid-leg via points |
| unsure what the box above "which sail" is | it was the map; now labelled, draws the whole course behind, and names the marks |
| no indication of the marks a leg ran between | leg title is **"Leeward → Windward"**, from the linked course |
| skip / keep / previous feels unnatural | gone. A plain pager; a leg is **used by default**, with the toggle beside the point count where its consequence is visible |
| want a review screen at the end | added — per sail, plotted against your existing table, before anything is written |
| legs should follow the course, not each tack | the whole round |
| (from B) map you don't click, that follows next/prev | the map is now read-only and follows the pager |

#### This needed a new simulator script

The old race tacked **once** per beat, so "a leg" and "a tack" were the same
thing and the question couldn't even be asked. The first windward-leeward cut
sailed headings for a duration and marched **4.3 km downrange**, so roundings
never clustered; `nmea-sim/scripts/wl-race.json` makes the run legs reciprocals
of the beat legs so the course closes (extent 1.4 km). Worth knowing generally:
**nmea-sim sails headings, never *to* marks**, so any question about mark
positions or course geometry needs the script built to close.

#### Still open after round 4

- **Legs 9 and 10 are both "Leeward → Windward"** — the 2-minute dropout split
  one beat in two and nothing notices that a leg is a *continuation*.
- The map is GPS-only: no chart, no land. Whether it needs real tiles is next.
- Reversal is still a stub (`commit` alerts).

<details>
<summary>Round 3 (leg = tack) — superseded, findings retained</summary>

### Round 3: the leg is the unit of review

Logan's reframing, and it is the right one: *frame it locationally — go leg by
leg, assign a sail to a whole or part of a leg, trim the ends for hoist and
drop, derive a few stable points from what's left.*

The gain is not cosmetic. Rounds 1–2 asked for **118 judgements** about bins a
sailor has no intuition for; this asks for **17**, each of which is a sentence
a sailor would say out loud — *"that was the beat to the top mark, on the J1,
ignore the first 25 seconds."* The points are then derived, not judged.

**Leg detection is real and scored against the simulator's ground truth**
(which knows exactly when the boat was manoeuvring and which sail was up):

| | |
| --- | --- |
| legs detected | **17** |
| legs containing more than one sail | **0** |
| manoeuvre seconds inside a leg | **0** |
| race covered by some leg | **79 %** |
| points derived | **188** (median 10/leg) |

Rule, chosen from a 36-point sweep: over a ±20 s window a boundary is a heading
change ≥ 45°, a **TWA sign flip**, or a **TWA magnitude change ≥ 12°**; minimum
leg 60 s; data gaps are boundaries. A tack-sized threshold *alone* is not
enough — it merged the whole downwind wardrobe into one 1,100 s blob with 68° of
TWA spread, because a kite peel turns the boat 22–30°, not 90°.

Legs are named in the language the domain already uses — Beat, Reach, Broad
reach, Run — which comes free from median TWA.

The three variants now disagree only about **how you work a leg**, since the
framing itself is settled:

| | Variant | Shape | The bet |
| --- | --- | --- | --- |
| **A** | One leg at a time | wizard, 17 screens | the screen should ask exactly one question |
| **B** | The chart | the track is the primary object | you recognise a leg by its shape on the water |
| **C** | The log | all 17 rows at once | 17 is small enough to just show |

### Two things the leg framing exposed

1. **5 of 17 legs have no sail stamped — and every one is the leg straight
   after a tack.** You don't re-announce the sail when you tack. Carrying the
   previous leg's sail forward fixes all five and is **5/5 correct against the
   truth**, so `C` offers it as one tap. **This is a direct constraint on `19`:**
   a stamp's claim must *cross* manoeuvres, and stopping at the next boundary
   would strand a third of the race.
2. **Leg 5's stamp is simply wrong** — it reads A2, the boat was on the A5,
   because that peel was tapped 70 s early and landed in the previous leg. This
   is exactly the silent misattribution `19` forbids, and the leg framing is
   what makes it *visible*: leg 5 is the one leg whose numbers don't fit its
   sail (115° TWA, and it yields 1 point against a median of 10). Turn on
   **show actual sail** in the harness to see it. A per-leg plausibility check —
   *does this leg's TWA sit inside the claimed sail's band?* — looks like a
   cheap, real defence, and it only exists because the leg is the unit.

### Round 2, retained for the record

Rejected as too complex, but three measurements from it still stand and are
worth carrying into whatever ships:

- **One race produces 118 proposals across 6 sails**, 117 of which overlap the
  existing table — the screen's dominant job is *comparison*, not gap-filling.
- **The median flat-rule proposal is fed by 17 separate stretches**, most 1–3 s
  long. A question for `07`: should steadiness require *contiguity*? Note the
  leg framing answers this implicitly — a leg **is** a contiguous stretch.
- **Attribution gates promotion, measurably**: correcting the sail stamps moved
  the flat rule from 118 to 120 proposals and made the A5 bins exist at all.

<details>
<summary>Round 2's three variants (rejected)</summary>

Three structurally different bets on what the primary object is:

| | Variant | Primary object | What it bets |
| --- | --- | --- | --- |
| **A** | The Tape | time | you want to see the race and select stretches yourself; proposals are an overlay |
| **B** | The Inbox | proposals | you never want to see two hours of data; you want yes/no on candidate points |
| **C** | The Polar | the polar table | promotion is a judgement about a polar, so the polar should be on screen |

They disagree hardest on **question 2**: A gives an overview window plus
drag-select, B answers "you don't navigate time at all", and C navigates the
*polar* and derives the time range from the bin.

### The data is real, with two marked exceptions

A two-hour `nmea-sim` race reduced through `05`'s row shape for real
(anchor-triggered on `MWV,T`/`VHW`, 250 ms coalesce, 750 ms floor, TTL-null) —
**7,035 rows from 7,200 seconds**. Synthetic and flagged in the builder: the
faults (see below) and the sail assertions, which are deliberately wrong in
three ways — first hoist 95 s late, one peel tapped 70 s early, the A5 hoist
missed entirely — because question 3 has no teeth against tidy data.

### Four things found while building it, before any reaction

1. **`nmea-sim`'s faults never fire in `generate` mode.** They are armed per
   *connection* (`withFaults` wraps the socket source), so the headless
   generator can only ever emit a clean log. Anything that needs to exercise
   the pipeline against faults must drive `sail` over a real socket — which
   also means a fault-injected 2-hour session costs 2 hours of wall clock.
   Worth a line in `nmea-sim/README.md`; the review screen's holes are punched
   in afterwards instead.
2. **One race produces 118 proposals across 6 sails**, and **117 of them
   overlap the existing table** — only one lands where the imported polar has
   nothing. So this screen's dominant job is *comparison*, not gap-filling.
   That is variant B's central problem stated in numbers: a 118-card queue from
   one Wednesday evening.
3. **Contributing samples are badly fragmented** — the **median proposal is fed
   by 17 separate stretches**, most 1–3 seconds long, scattered across both
   laps. Every variant implies a proposal is one highlightable stretch, and it
   is not: A's "jump to it" shows one of seventeen, and B's evidence sparkline
   has to admit the same in a footnote. **This is a question for `07`:** should
   the steadiness rule require *contiguity*, or is a bin allowed to be a
   scatter of seconds?
4. **Question 3 gates question 4, measurably.** Correcting the three assertion
   mistakes takes the proposals from **118 to 120** and makes the A5 bins exist
   at all — they are invisible until the missed hoist is asserted. The harness
   toggle does this live. So sail attribution is not a tidy-up step after
   promotion; nothing can be proposed for a sail that was never claimed.

### One assumption in it is already superseded

Built against founding decision 4's **"an assertion holds until the next one"**.
`09` resolved concurrently with this and replaced that with a **stamp** — a bare
point in time that must *not* propagate forward indefinitely — leaving the
attribution rule to `19`, which is open and blocked by `07`.

What that does and doesn't cost:

- **A's sail lane is drawn wrong.** Contiguous coloured blocks running to the
  next assertion *are* the hold-until-next model. Under stamps the lane needs
  marks plus an explicit **unattributed** state, and the honest version of it
  can't be drawn until `19` settles what a stamp claims.
- **B gets more right, not less.** Its blocking card — "*this much sailing has
  no sail on it, nothing here can become a point*" — is exactly the state
  stamps produce far more often.
- **C is unaffected**: it never shows attribution over time, though that is also
  why the missed hoist is invisible in it.
- **The 118/120 proposal counts still stand** as a demonstration that
  attribution gates promotion. The specific numbers move once `19` lands.

Worth re-reading the variants with that in mind rather than rebuilding now —
the rule to build against does not exist yet.

### Deliberately not varied

The **session list** (question 7) is shared across all three — three versions of
a list would be wallpaper. It carries the three states that matter: good,
failed, empty. Round 3 drops it entirely to stay on the contested part.

</details>

### Round 3's open items (all closed by round 4)

- Question 5's manual path — the split now exists.
- Question 6, reversal — still a stub.
- Question 1's map — round 3's `B` let you tap the track and it overlapped
  itself badly. Round 4 makes the map read-only and pager-driven, which is what
  Logan asked for after seeing it.

</details>

### Verified

Every round driven headlessly in jsdom, **no JS errors**. Round 5 specifically:
three successive cuts on one leg give 5 blocks / 4 dividers and take that leg
from 14 points to 3; **merge** puts a cut back; edge nudges clamp at a 15 s
minimum; splitting a 10 s block is correctly refused; the map chip toggles
focus; and the clean review is 9 TWA bands across J1 (150 pts) and A3 (81 pts),
each row carrying this-race speed, table speed and the delta. **Not judged by
eye** — that's the handover.

## Answer

**Review is one screen per course leg, and a leg is a row of spans.** Round 5
([`10-review-leg-spans.html`](../prototypes/10-review-leg-spans.html)) is the
accepted design; rounds 1–4 are on `prototype/10-review-screen` with the
reasoning that got there.

### 1. The unit of review is a course leg, mark to mark

Not a proposal, not a tack. You page through the legs; each is a sentence a
sailor would say out loud — *"the beat to the windward mark, on the J1, ignore
the first 25 seconds"*. This race: **20 legs, containing 34 tacks and gybes**.
Judging tacks separately was explicitly rejected — nobody wants a screen per
tack up a beat, and a VMG-gybing boat won't judge each gybe.

### 2. Legs are detected on |TWA|, and it works without a course

Over a **±90 s window**, a boundary is a change in **median |TWA| of ≥25°**;
minimum leg **180 s**; data gaps are boundaries. **The sign is ignored** — that
is the whole trick: a tack flips TWA's sign and keeps its magnitude, a rounding
changes the magnitude. Sign is *which tack*; magnitude is *point of sail*; a
course leg is a point of sail.

| | |
| --- | --- |
| roundings found | **14 / 14** |
| spurious boundaries | **0** |
| median timing error | **33 s** |
| legs containing >1 sail, untrimmed | 16 / 20 |
| …after the default trim | **0 / 20**, costing 7 % of the race |

Measured against a purpose-built windward-leeward with four tacks per beat
(`nmea-sim/scripts/wl-race.json`, added for this).

**The end trim is not only for hoists and drops — it absorbs the detection
error.** That is what makes a ±33 s boundary survivable, and it welds the trim
default to the detection tolerance: they are one decision.

Rejected: segmenting on **heading** (a tack and a rounding are both ~90°, so it
merges nothing) and on **GPS net-travel bearing** (14/14 but with 14 spurious
boundaries). Net bearing is still the right backstop for the one case |TWA|
misses — consecutive legs at the same angle on opposite gybes, e.g. an
out-and-back reach.

**Mark names need the linked course.** Inferring them from where the boat
rounded was tried and fails: roundings smeared into **4 clusters where 2 marks
exist**. With no course, legs fall back to "Beat 3 / Run 3" and the user renames.

### 3. A leg is a row of spans — one mechanism, not four

```
[ not used ][   J1   ][ not used ][   J1   ][ not used ]
  the hoist                a cut                the drop
```

Every block carries **a sail, or nothing**. Trimming the head, trimming the
tail, cutting a section from the middle, and changing sail mid-leg are all the
same act. Consequences: any number of cuts for free; every block resizable,
splittable and removable; **merge** (delete a divider) is the universal undo.
Drag the band to move the nearest divider, or nudge a selected block's edges
±5 s / ±15 s.

Multiple sails per leg is the hook the separate **via points** work plugs into.

**The default spans are load-bearing**: every leg opens *not-used / sail /
not-used* at 25 s and 10 s. That default is what holds mixed-sail legs at 0/20;
"one block, all used" would leak the detection error into the polars.

### 4. Promotion review is per sail, per 10° TWA band

A table, not a scatter: TWA band, the TWS range feeding it, what this race says,
what your table says, the delta, and the point count. A scatter of dots gave
nothing to argue with; *"we were 4 % quick at 40–50°"* does.

### 5. The map is read-only and follows the pager

You never tap the track to navigate — next/prev moves the highlight. Each span
draws in its own colour, so cuts and sail changes are visible on the water. A
chip **on the map** switches focus-leg ⟷ whole-course, so it is a per-glance
choice rather than a remembered mode.

### 6. Session list (question 7)

By date, with duration, sample count and wind range; three states — good,
**failed** (opens to a dead end explaining why nothing is usable) and **empty**.
Not varied across rounds; it was never the contested part.

### 7. What `07` does to the numbers on this screen

The prototype derived points with a placeholder (median, 1 kn × 4°, **min 8
samples**, no steadiness filter) because `07` was open. `07` has since settled a
stricter rule — steadiness filter, then **≥30 samples per bin**. Re-running the
accepted design's default spans under it:

| rule | points from this race | median per leg | legs yielding nothing |
| --- | --- | --- | --- |
| prototype placeholder (min 8, no filter) | 217 | 11.5 | 0 |
| **`07` as settled (min 30, filtered)** | **45** | **2** | **2** |

*(Steadiness approximated — the prototype blob carries TWA, not heading.)*

**The shape of the screen is unaffected; the numbers on it are ~5× smaller.**
That is closer to the original framing — *"derive a few stable points from
what's left"* — and it means the design must read well at **1–4 points per leg**,
not 11: the point pill, the review table's row count, and the fact that **a leg
can legitimately yield zero**. Worth a second look at the review screen with 45
points in it rather than 231.

### Known gaps, deliberately not fixed here

- **A leg split by a dropout isn't recognised as a continuation** — legs 9 and
  10 are both "Leeward → Windward" because the 2-minute silence broke one beat
  in two. Detection edge case, cheap to fix at build time.
- **A block under ~15 s cannot hold a bin** and silently contributes nothing; it
  should say so.
- **Deltas read as huge where the stored table is weakest** (the review shows A3
  at +13 % to +24 %). Mostly an artifact of the prototype's synthetic existing
  table, but the risk is real and it is the same question as `16`'s coverage
  rule — the comparison needs a confidence cue where the table has no support.
- **Reversal (question 6) is still a stub.** The mechanism is settled — every
  point is tagged to its session — but the surface isn't designed. `06` already
  covers deleting a recording and its whole contribution.
