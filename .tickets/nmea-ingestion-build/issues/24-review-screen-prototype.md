# 24 — Prototype: what shape is the review screen?

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8. User stories 44–61, 67.

**What to build:** Three throwaway HTML variants of the sailed-leg review screen,
driven off Saturday's real race, to settle how the screen decomposes — and what a
readable speed trace looks like — before any of it is built for real.

**Blocked by:** nothing.

**Status:** ready-for-agent

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

## Acceptance criteria

- [ ] One HTML file in [`prototypes/`](../../nmea-ingestion/prototypes/),
      `?variant=A|B|C` plus arrow keys, following the existing convention
- [ ] Header comment records the round, what was rejected before, and why this
      reopens an accepted prototype
- [ ] **Driven off Saturday's fixture**, not synthetic data — real leg names,
      real sample counts, real speed traces
- [ ] Variant A: one scroll, decomposed into sibling sections
- [ ] Variant B: two screens, a route per leg
- [ ] Variant C: two screens, review is a single route holding the pager
- [ ] Every variant shows the ugly cases: the 387-sample leg beside the
      2,410-sample one, the ground-wind warning, and the "No sailed legs found"
      session from the second recording
- [ ] Every variant carries the chart treatment above
- [ ] The steadiness-mask measurement is recorded before the overlay is drawn
- [ ] An accepted variant, with the reasoning written down for `25` to build from

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
