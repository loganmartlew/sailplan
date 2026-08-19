# 24 — Prototype: what shape is the review screen?

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8. User stories 44–61, 67.

**What to build:** Three throwaway HTML variants of the sailed-leg review screen,
driven off Saturday's real race, to settle how the screen decomposes — and what a
readable speed trace looks like — before any of it is built for real.

**Blocked by:** nothing.

**Status:** done — variant **D** accepted 19 August 2026

## Why this reopens an accepted prototype

The screen that shipped **is** the accepted prototype. `10-review-by-leg.html`
ran three variants in round 3 — A "one leg at a time, a wizard", B "the race
track is the primary object", C "the log, all legs as a list" — and **A won**,
on the reasoning that the leg as the unit of review turns 118 judgements into 17
a sailor can actually make. Rounds 4 and 5 refined the band. Nothing since has
challenged that reasoning and this ticket does not reopen it.

What those rounds never had was **a real race in them**. After 15 August 2026 the
screen has been used against 2:14:50 and 6,453 samples, with legs ranging from
387 to 2,410 samples, and Logan's reaction was structural: everything below the
session header is one card, with a second card nested inside it, and the primary
action sits roughly 2.5 screens down. The unit of review is right. The page
around it is not.

There is also a concrete misfiling the shipped layout makes obvious: the
ground-referenced-wind and low-confidence warnings render in
`[sessionId].tsx:87–110`, **below the entire pager**. A warning that the
session's data may be systematically wrong sits two and a half screens beneath
the UI used to accept that data.

## In bounds

- Where session facts live versus leg work — they are two subjects sharing one
  scroll today, which is what the mega-card is a symptom of
- One scroll, or two screens; and if two, whether review is one route holding the
  pager or a route per leg
- Where leg navigation and the primary action sit
- Card decomposition, including removing the nested card
- **The speed trace** — see below. This is the strongest single reason to
  prototype rather than just build

## Out of bounds — settled, do not re-litigate

- **The leg is the unit of review** (rounds 1–5, `10-review-by-leg.html`)
- **The band-and-divider mechanic** (accepted round 5, verified on a physical
  device 17 August 2026 — see `15`'s verification note)
- **The inline map is read-only** — settled in `16`, re-confirmed in `23` after
  pinch-zoom was tried on device and read as broken rather than restrained

## The chart

The trace has one declared purpose. Spec §8: *"nothing says **when** in the leg
the boat went slow, which is the only question a divider can be an answer to."*
It is a divider-placement aid, deliberately not a data display. Logan's
complaint — *"can't really see what speed was being done"* — asks it to also be a
readout, and the two pull apart: a placement aid wants maximum vertical detail, a
readout wants a scale you can read values off.

Settled direction, to be drawn in the variants:

- **Gridlines and a truthful axis**, matching the polar chart screen's treatment
  two taps away in the same app. This costs the placement job nothing — a dip is
  just as visible with a grid behind it
- **The current top-right label is a lie and must go or change.**
  `traceGeometry.ts:5,50` computes `topSpeed = max(observed, 4) × 1.15`, so
  "9 kn" is the headroom-inflated axis ceiling, not a speed anyone sailed. On the
  captured leg the real maximum was ~7.8 kn. Label the max as a max, or drop it
- **Fix the no-sail shading.** `SpanTrace.tsx:44–53` shades unattributed spans at
  18 % opacity. When every block is unattributed — the state every leg opens in —
  the whole chart is shaded and reads as background chrome, so the "nothing is
  attributed here" signal is invisible precisely when it matters most
- **Overlay the steadiness mask** on the trace, so the stretches that will
  actually become polar points light up and the tacks stay dark. This answers
  *"what data are we getting out of this leg"* visually, on this ticket's
  timeline, without waiting for `18` — and dragging a divider to include or
  exclude a lit region becomes a directly meaningful act

## Gate — do this first

`findSteadyStretches` already runs on this screen's data
(`draftAttribution.ts:314`) and already returns `medianBoatSpeed`, `medianTws`
and `medianAbsTwa` per stretch. But **the replay test does not exercise it**, so
how much of a real race it actually accepts is unknown.

Measure it against `saturday-race.log` **before** drawing the overlay into any
variant — the fixture is committed and `replayCaptureSession` runs off-device in
3.7 s, so this is cheap. If the mask barely fires on real data the overlay comes
out and the chart work drops back to plain axis treatment. Record the number
either way; `18` and `26` both need it.

## Gate measurement — recorded 19 August 2026, before any overlay was drawn

`findSteadyStretches` run per detected leg over `saturday-race.log`, through the
real pipeline (`rawLogReplayInput` → `replayCaptureSession` → `detectSailedLegs`),
off-device in 3.3 s. Generator:
`features/capture/util/__tests__/prototype24ReviewData.test.ts` (throwaway, on
the prototype branch), which also writes the variants' data.

```
session 8,023 samples · windFrame water · 2:14:49
7 legs · 127.6 min of leg time · 28.1 min steady · 22.0 % coverage
72 stretches, median 20 s (range 15–56 s) · 88 whole 15 s bins
legs with zero steady stretches: 0

leg 1 Resolution → North Head   1,321 samples 22.1 min   5 stretches  105 s   7.9%   max stw 10.2 kn
leg 2 North Head → Salt Works     709 samples 11.9 min   7 stretches  148 s  20.7%   max stw 11.2 kn
leg 3 Salt Works → North Head   1,337 samples 22.3 min  20 stretches  486 s  36.3%   max stw  8.2 kn
leg 4 North Head → Salt Works     754 samples 13.0 min   5 stretches  100 s  12.8%   max stw  9.7 kn
leg 5 Salt Works → Orakei       1,721 samples 28.9 min  24 stretches  650 s  37.5%   max stw  7.9 kn
leg 6 Orakei → Bayswater        1,315 samples 22.1 min   8 stretches  143 s  10.8%   max stw 10.2 kn
leg 7 Bayswater → Westhaven       439 samples  7.4 min   3 stretches   56 s  12.6%   max stw  7.4 kn
```

**Verdict: the overlay stays in.** The mask fires on every leg — the failure
mode the gate was written to catch (a mask that barely fires, making the overlay
decoration) did not occur. 22 % coverage with 3–24 lit regions per leg is enough
to read as structure rather than noise, and the spread between leg 5 (37.5 %) and
leg 1 (7.9 %) is itself the signal: it says which legs this race actually gave
data, which is what `26` will show numerically.

**Median stretch is 20 s** — barely over `STEADY_MIN_MS`, so most stretches are
one bin wide. Nudging a divider by 15 s can delete a point outright, which is
the argument for drawing the mask under the divider.

### Follow-up probe — the mask is far tighter than §8 assumed

Logan's reaction to the drawn overlay was that it is *"super sparse when it
shouldn't be"*. It is, and the cause is one constant. Probing every candidate
15 s window inside a leg for which of `isSteady`'s three tests rejects it:

```
7,424 candidate windows inside legs; 487 pass (6.6%)
  rejected by heading ±5°   : 35.4%  (sole reason  1.2%)
  rejected by speed   ±5%   : 51.3%  (sole reason  2.7%)
  rejected by TWS     ±1 kn : 88.6%  (sole reason 27.6%)
```

`MAX_TWS_DEVIATION = 1` is doing essentially all of the rejecting. Median TWS on
this race was 14.7 kn, so ±1 kn is ±7 % of the wind; real gusty wind fails it
constantly. Heading and boat speed barely bind alone. The threshold has only
ever been exercised against `nmea-sim`, whose wind is steady by construction.

What loosening it buys, measured through the real `proposePolarPoints` with the
whole race attributed to one sail:

```
                              coverage   stretches   polar points
shipped   tws ±1.0             22.0%        72           10
          tws ±1.5             41.1%        93           24
all loose hdg 10 spd 10 tws 2  76.4%        83           38
```

**Correction to the bin figure above.** 88 bins is *not* the ceiling on promoted
points: it ignores `MIN_BIN_SAMPLES = 30` and the TWS/TWA binning in
`promotion.ts`. The whole race attributed to one sail yields **10 polar points**.
§8 records an expectation of **~45 points, median 2 per leg**. The shipped mask
delivers roughly a quarter of that.

Also worth naming: `promotion.ts` bins TWS to 1 kn centres
(`TWS_BIN_WIDTH = 1`), so holding raw TWS within ±1 kn of the window mean
*before* binning at 1 kn enforces the bin width twice.

**Not retuned here.** A threshold that decides what becomes polar data is `18`'s
call, not a prototype's. Recorded for `18` and `26`; the overlay in the variants
draws the shipped mask, so what is on screen is what the sailor would get today.

### Numbers in this ticket that the fixture does not reproduce

The header above quotes the device: 6,453 samples, legs of 387 and 2,410. The
fixture replays the same recording to **8,023 samples and legs of 439–1,721**.
Both are right — the device count is what survived storage, and the leg range
above is post-`22` course-anchored detection, where the device's was the
pre-`22` nine-leg split. The variants draw the fixture's numbers, which are the
ones the shipped detector produces.

## Acceptance criteria

- [x] One HTML file in [`prototypes/`](../../nmea-ingestion/prototypes/),
      `?variant=A|B|C` plus arrow keys, following the existing convention —
      [`24-review-screen-shape.html`](../../nmea-ingestion/prototypes/24-review-screen-shape.html).
      A fourth variant **D** was added mid-round; see below
- [x] Header comment records the round, what was rejected before, and why this
      reopens an accepted prototype
- [x] **Driven off Saturday's fixture**, not synthetic data — real leg names,
      real sample counts, real speed traces, real track, real steady stretches
- [x] Variant A: one scroll, decomposed into sibling sections
- [x] Variant B: two screens, a route per leg
- [x] Variant C: two screens, review is a single route holding the pager
- [x] Every variant shows the ugly cases — the fixture's **439-sample leg 7
      beside its 1,721-sample leg 5** (see the note on the ticket's 387/2,410
      figures above), the ground-wind warning, and the "No sailed legs found"
      session. The empty session is the one synthetic thing in the file and is
      labelled so in the harness: there is no second fixture
- [x] Every variant carries the chart treatment above
- [x] The steadiness-mask measurement is recorded before the overlay is drawn
- [x] An accepted variant, with the reasoning written down for `25` to build from

## Prior expectation

C — two screens, review as a single route — is the favourite going in, because it
separates the two subjects, gives leg navigation a real home in a header, lets
each screen take the app's standard shape, and avoids a router animation per leg
when paging through 7–20 of them. It also gives the session screen a **leg list**,
which it badly needs: today the only way to learn what is in a session is to page
through it.

Note that C only became available in this session. `23` rejected a pushed route
for the fullscreen map because *"it would re-query the database and draw the
stored spans, disagreeing with the draft band the sailor is editing (`draftSpans`
is unsaved state)"*. Once `25` persists spans on navigation, stored **is** draft
and that objection dissolves.

Do not treat the favourite as the answer. Draw all three.

## Accepted — variant D, 19 August 2026

**D: the list is home, and one route names the leg.** Not one of the three the
ticket asked for. A, B and C were drawn as specified and reviewed together; D
was drawn after that pass, out of two reactions to it, and accepted.

### The two reactions that produced it

1. *"Nice to be able to see all legs at once"* — the thing worth having in B was
   the **leg list**, not the per-leg routing.
2. *"I don't see a need to mark a leg as reviewed other than saving any changes
   made to it."*

The second is the load-bearing one, because it dissolves the question the ticket
was asking:

- **A's bottom bar loses its reason to exist.** Its whole justification was that
  the primary action sat 2.5 screens down — but with no per-leg act, the primary
  action belongs to the *session* (Promote), not the leg. A was drawn around a
  button that should not exist.
- **The wizard framing dies with it.** Review stops being a linear pass with a
  finish line. Once there is no linear pass, *"which leg am I on"* stops
  mattering and *"which legs still need work"* starts — which is a list, and is
  what a pager structurally hides.
- **C's edge over B was paging economics** — one push, no animation per leg.
  That is an advantage in a journey nobody would take any more.

So the honest choice was not A vs B vs C. It was: when you finish a leg, are you
**handed the next one** (A, and C's pager) or **returned to the list** (B, D)?
Returned to the list.

### What D is

- The session screen **is** the list. Facts, warnings hoisted to the top,
  whole-course map, then a row per leg reporting **what that leg yields** —
  sails, `n/m` steady bins, an *edited* marker — rather than whether it was
  ticked.
- Tapping a leg enters **one** review route that **names the leg in its path**.
  The header's ‹ › page by `replace`, not `push`: the back stack never grows,
  back always means "back to the list", and a leg stays deep-linkable. This is
  C's single-stack economics with B's list-first entry.
- **Nothing confirms.** Edits save as made; the header says *Saved* or *Opening
  default — nothing changed yet*. The leg screen has **no bottom bar at all** —
  header, scroll, done. The `used` toggle moves up beside the header, and a
  struck-out leg shows as a strike-through in the list.
- The session's one primary action is **Promote**, which is also the only screen
  that shows what will actually be written.

### How this lands against `25`, which was written before the round

Closer than expected — `25` had already split confirmation into *reviewed* and
*cleared for the polar*, and D is that split drawn:

- `25`'s **"No terminal action. Review ends by going back"** is exactly D's leg
  screen. No Finish, no "Review complete" card.
- `25`'s **`reviewedAt`, set by navigating away from a leg**, is D's *edited*
  marker. Note the small difference worth keeping: D derives it from *the spans
  having changed*, not from having visited. Deriving it from a visit sets it on
  a leg the sailor merely glanced at, which is the wrong answer for the
  re-detect warning and for the resume guard — the two places `25` needs it to
  mean "there is hand work here to lose".
- `25`'s **leg list on the session screen** and **warnings above the leg work**
  are both drawn.
- `25`'s **`Promote` CTA on the session screen** is D's bottom bar.

### The one cost, which `25` must take deliberately

`promotion.ts:118` filters `confirmedAt !== null && leg.used`. With no per-leg
act, a leg the sailor never opened can contribute its **draft** attribution.
That is only reachable when sail stamps exist — this race had none, so every leg
opened empty — and `18`'s promotion screen shows every proposed point before
writing. `25` already has the right answer in its criteria (*"`18` reads
`reviewedAt` as its gate"*); D just makes `reviewedAt` mean *edited* rather than
*visited*.

### Left open

Whether the leg screen keeps the header's ‹ ›  at all, or whether returning to
the list is the only way between legs. D draws them because paging is cheap once
it is a `replace`, but nothing in the round tested whether they get used.

### Where the prototype's own artefacts live

- [`24-review-screen-shape.html`](../../nmea-ingestion/prototypes/24-review-screen-shape.html)
  — the four variants, `?variant=A|B|C|D`
- `24-data.json` beside it — the inlined real-race payload
- `sailplan-app/features/capture/eval/reviewPrototypeData.eval.ts` — regenerates
  that payload and prints the gate numbers
- `sailplan-app/features/capture/eval/steadinessProbe.eval.ts` — the threshold
  probe behind the findings above

Both evals are opt-in (`.eval.ts` runs in no default suite):
`npx jest -c jest.eval.config.js features/capture/eval/`.

