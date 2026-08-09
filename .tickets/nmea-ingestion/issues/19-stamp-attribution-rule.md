# 19 — What does a sparse sail stamp actually claim?

Type: grilling
Status: resolved
Blocked by: 05, 07
Map: [map.md](../map.md)

## Question

`09` replaced the "assertion holds until the next one" model with a **stamp**: a
bare point in time saying *the #3 was up at 14:32*, tapped opportunistically and
often forgotten. Logan's framing: *"later on similar angles/speeds around the
same time are assumed to be that sail too."*

That leaves the attribution rule undefined, and it is now the mechanism by which
a session becomes polar points at all — not a nicety. `09` fixed one hard
constraint on it and nothing else:

> A stamp must **not** propagate forward indefinitely. Forgetting to stamp after
> a sail change must produce *unattributed* samples, never *wrongly attributed*
> ones. Silent misattribution poisons a polar; an unattributed stretch merely
> wastes it.

1. **The window.** Around a stamp, what claims the samples — a fixed time span, a
   span that grows until the conditions stop resembling the stamp's, or
   something bounded by the next stamp? What happens between two stamps of
   *different* sails, where the swap could have been anywhere in between?
2. **"Similar angles/speeds".** Similar by what measure, and how far can it
   drift before attribution stops? Note `05` stores signed TWA, so a tack is a
   sign flip, not a change of conditions — the rule must not treat crossing the
   wind as a sail change.
3. **The unattributed remainder.** What happens to samples no stamp claims? Are
   they discarded, kept but unpromotable, or offered for hand-attribution in
   review (`10` q5)?
4. **Interaction with `07`.** `07`'s steady-state filter and this rule both cut
   the session into stretches. Do they compose, or does one subsume the other?
   `10` already found bins fed by ~10 fragments of 1–3 s each — attribution must
   survive that fragmentation.
5. **Confidence.** Should a point promoted from a stretch far from any stamp be
   marked as weaker than one promoted from a stamp's immediate neighbourhood?
   Careful: `15` rejected a second implicit trust knob for exactly this shape of
   reasoning.
6. **Wrong or missing stamps.** The prototype session in `10` already models
   these (late hoist, early peel, a missed hoist). The rule should be judged
   against those, not against tidy data.

> ### `10` has changed the shape of this question
>
> `10` resolved to **one screen per course leg, with the leg divided into spans
> that each carry a sail or nothing**. That gives this ticket a frame it did not
> have when it was written:
>
> - **Time-based propagation may not be the answer at all.** The question "how
>   far forward does a stamp reach" becomes "**which span does a stamp claim**",
>   and spans have real edges — mark roundings — rather than an arbitrary decay.
>   Q1's "fixed span vs growing span vs bounded by the next stamp" should be
>   re-read as "bounded by the *leg*".
> - **Q2 is largely answered.** Legs are detected on **|TWA| ignoring the sign**,
>   so a tack is already not a change of conditions — the thing Q2 warned about
>   is structural, not a tolerance to tune.
> - **A stamp must cross manoeuvres.** Measured in `10` round 3: **5 of 17 legs
>   had no stamp, and every one was the leg straight after a tack** — you don't
>   re-announce the sail when you tack. Carrying the previous leg's sail forward
>   was **5/5 correct** against the simulator's truth. A rule that stops at the
>   next boundary strands a third of the race.
> - **Q4's fragmentation worry is gone.** It cited `10`'s finding that bins were
>   fed by ~10 fragments of 1–3 s. That was the *flat* rule; a leg is contiguous
>   by construction, and `07` has since settled the filter.
> - **Q6's test data exists**: the round-4/5 prototype session models a late
>   hoist, an early peel and a missed hoist, and `10` found the early peel lands
>   in the *previous* leg and silently mis-attributes it — the exact failure this
>   ticket forbids. `10`'s leg framing is what made it visible, because it was
>   the one leg whose numbers didn't fit its sail.
>
> Worth re-reading the question before answering it; `05` and `07` are both
> resolved, so this is unblocked.

## Answer

Settled by grilling. The central distinction is between **evidence** and an
**editable inference**: a sail stamp is evidence about one instant; a
sail-attribution span is the reviewable claim the app derives around it.

### 1. A stamp is a point observation, never an interval

Tapping J1 at 14:32 means only **“J1 was up at 14:32.”** It does not remain in
force until another stamp and does not, by itself, claim the containing leg.
This preserves `09`'s safety property: missing a later sail change cannot make
an old observation silently claim the rest of the recording.

The review model from `10` supplies the derived object: the app uses stamps and
nearby conditions to propose editable **sail-attribution spans**, each carrying
one sail or nothing. These proposals are drafts, not new evidence.

### 2. Proposals are leg-local and may cross a tack, but never chain

The stamp seeds a draft span in the detected course leg containing it, retaining
`10`'s default unused head and tail guards. A stamp may also seed **one
immediately adjacent unstamped leg** when all of these are true:

- the two legs' median `|TWA|` values fall in the same **10° review band**;
- their median TWS values are within **2 kn**;
- there is no conflicting stamp; and
- there is no sustained boat-speed regime change.

Propagation is one hop from evidence, never recursive from one inferred leg to
the next. A detected rounding into materially different conditions stops it.
TWA sign is ignored, so a tack or gybe does not stop attribution when the point
of sail remains the same. This also lets a dropout-split continuation inherit
without turning a stamp into indefinite forward state.

If the evidence is insufficient — no stamp, only a distant stamp, no qualifying
steady stretch, or disagreeing similarity tests — the rule fails closed and
proposes **not used**. It never selects a sail because that sail's existing
polar happens to predict the observed speed.

### 3. Boat speed finds boundaries; it does not identify sails

Boat speed is an outcome of sail choice and sailing quality, so it is unsafe as
the primary classifier. It is useful as a change detector. While `|TWA|` and
TWS remain similar, a speed shift greater than **5%** becomes a candidate
boundary only when the new regime forms a **≥15 s steady stretch** on `07`'s
existing 3 s rolling medians.

The boundary is the gap between the last qualifying stretch of the old regime
and the first qualifying stretch of the new one. That transition interval is
proposed as **not used**; hoists, drops and manoeuvre transients therefore do
not feed either sail.

When different-sail stamps occur in one leg, each sail extends toward such a
credible boundary. If no credible boundary exists, the interval between their
stamp-supported regions remains unattributed — never split at an invented
midpoint.

### 4. Review confirmation is implicit in the pager

Attribution has three categorical states: **draft**, **confirmed**, and **not
used**. There is no numeric attribution-confidence score and therefore no
second trust knob competing with `07`'s evidence rules.

The sailor confirms the visible blocks by moving **Next** to the following leg;
**Finish** confirms the last leg. No separate confirmation control is needed.
Leaving review keeps the current and later legs as drafts; already advanced
legs remain confirmed. Revisiting and changing a confirmed leg replaces its
prior confirmation.

Only confirmed sail spans can contribute samples to promotion. Unconfirmed and
not-used samples remain in the recording, available for later manual
attribution or reprocessing, but cannot produce `sailPolar` points.

### 5. Attribution and the steady-state filter compose through one shared mask

They do different jobs and neither subsumes the other:

1. `07`'s sail-independent steadiness test produces the session's steady
   stretches once;
2. attribution uses those stretches only to recognise sustained speed regimes
   and propose boundaries, while stamps provide the sail identities;
3. review decides **which confirmed time intervals belong to which sail**; and
4. promotion intersects those confirmed spans with the same steady-stretch
   mask, then applies `07`'s binning, minimum-evidence, median and MAD path.

Manual span edits change step 3 only. They do not bypass step 4, except for the
manual-selection warning/override already settled by `07`.

### 6. Check against `10`'s deliberately bad stamps

- **Late hoist:** the stamp seeds its leg; the unused head guard and steadiness
  test exclude the hoist transition.
- **Early peel:** conflicting evidence creates separate proposed sail regions
  with an unused transition, so the previous sail no longer leaks across the
  peel.
- **Missed hoist:** the material `|TWA|` change prevents carry-forward; the leg
  stays not used instead of receiving the wrong sail.
- **Tacks and split legs:** sign-insensitive TWA comparison carries through a
  tack, and the local similarity rule can reunite adjacent fragments without
  allowing indefinite propagation.

This resolves the apparent conflict between usefulness and safety: inference
may be helpful and fairly ambitious in the draft, while advancement through
the review is the act that makes its visible spans authoritative for promotion.
