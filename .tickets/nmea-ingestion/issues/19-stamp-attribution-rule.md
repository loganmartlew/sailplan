# 19 — What does a sparse sail stamp actually claim?

Type: grilling
Status: open
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

<!-- filled on resolution -->
