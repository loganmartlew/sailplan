# Map: NMEA data ingestion

`wayfinder:map`

## Destination

An **implementable spec** at `.tickets/nmea-ingestion/spec.md` for capturing NMEA
data from the boat's B&G Zeus 3 during a race, reviewing it afterwards, and
promoting stretches of it into `sailPolar` points with a sail attached.

The map is done when someone could build that feature from the spec without
re-litigating any of the decisions below. Building it is a separate effort.

## Notes

- **Domain:** sailing — TWA/TWS/TWD, polars, tacks, sails. Read
  [`CONTEXT.md`](../../CONTEXT.md) before touching any ticket.
- **App:** Expo SDK 55 / React Native, Android only, SQLite + Drizzle. See
  [`sailplan-app/AGENTS.md`](../../sailplan-app/AGENTS.md).
- **Existing machinery this builds on:**
  - [`features/sailPolar/README.md`](../../sailplan-app/features/sailPolar/README.md)
    — the interpolation engine already has a **noise-tolerant clustered grid**
    (`buildClusteredPolarGrid`, "Package G") built specifically for logged
    instrument data: 1 kn TWS clustering, 4° TWA bins, median speed.
  - `polars/fixtures/noisy-log` + `npm run eval:suggestions` — an existing
    accuracy harness that can measure whether captured data helps or hurts.
  - `expo-location` is already installed **with `locationAlwaysAndWhenInUse`
    permission configured** in `app.config.js`; `expo-file-system` is present.
    No TCP socket library, no keep-awake, no task-manager yet.
- **Skills:** `/grilling` + `/domain-modeling` by default; `/research` for the
  research tickets; `/prototype` for the prototype tickets.
- **Standing preference:** this map produces decisions, not code. The one
  exception is the prototype tickets, which produce throwaway artifacts to
  react to.
- **Hard constraint — boat access is scarce.** Logan does not have the boat on
  demand. No ticket may sit on the critical path waiting for the water. The
  map is wired so design proceeds on documented behaviour (`01`) plus a
  simulator (`12`), and the on-boat tickets (`04` wire verification, `21` race
  day — both now on the same Saturday) are a **confirmation** step
  that may force revisions afterwards. Any new ticket that would need the boat
  must be checked against this before being wired as a blocker.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

- Destination, scope, and the eight founding decisions were settled in the
  charting session — see [Destination](#destination) above and the
  [Founding decisions](#founding-decisions) below.
- [01 — What the Zeus 3 actually puts on the wire](issues/01-zeus-3-nmea-output.md)
  — plain **NMEA 0183 ASCII over TCP, port 10110**, plotter as WiFi access
  point; **true wind is emitted directly** (`MWV,T` + `MWD`, so no
  apparent→true derivation); **all polar-relevant sentences are 1 Hz**; raw
  stream ~8–10 MB/hour. NMEA 2000-over-WiFi turns out not to be a real option,
  so that question is closed. Full findings:
  [research/01](research/01-zeus-3-nmea-output.md).
- [02 — Background TCP feasibility gate](issues/02-background-tcp-feasibility.md)
  — **GATE PASSED, with caveats.** Achievable via an Android foreground service
  of type **`connectedDevice`** (never `dataSync` — Android 15 caps it at
  6 h/24 h) plus `react-native-tcp-socket`, but there is **no drop-in library**
  and it needs a device spike (`13`). Two design-level consequences: **JS
  timers do not run while backgrounded**, so the pipeline must be event-driven
  plus a native tick; and **`interface: 'wifi'`** is the fix for the
  no-internet-WiFi trap. WifiLock is a dead API. Full findings:
  [research/02](research/02-background-tcp-feasibility.md).
- [12 — Simulating NMEA at home](issues/12-nmea-simulator.md) — **build our own
  ~300-line Node TCP simulator** (replay / scripted-sail / fault-injection);
  nothing off the shelf can do fault injection, and the best candidate
  (NMEASimulator) computes true wind angle wrong. **Signal K ships a real
  Navico GoFree log with both `MWV,R` and `MWV,T`** — usable today, before the
  boat. The ground-truth harness is worth building and already showed a
  **~8.3% overstatement from 90th-percentile derivation**, which challenges
  founding decision 7. Build ticket: `14`. Full findings:
  [research/12](research/12-nmea-simulator.md).

- [14 — Build the NMEA simulator](issues/14-build-the-simulator.md) — **built,
  14 self-tests green.** [`nmea-sim/`](../../nmea-sim/README.md): replay of a
  real Navico capture, a scripted sail at a known polar with ground truth, and
  fault injection as a *filter over both* rather than a third mode. The fleet
  ground truth moved to `polars/fleet.js`, shared with the fixture generator;
  the four existing fixtures regenerate byte-identical. **The boat is now off
  the critical path.** Two findings that change other tickets: holding the trim
  factor over a realistic dwell (rather than redrawing per sample) **halves**
  `12`'s p90 overstatement to +3.1 % and leaves **p75 nearly unbiased at
  +0.9 %** — see the table in the answer, which is `07`'s evidence; and the
  real GoFree capture turns out to be **already malformed** (every `$SDVLW`
  corrupt, 331 over-length lines), so `05` should treat sentence validation as
  v1, not hardening.

- [03 — Does captured data poison a sail's existing polar grid?](issues/03-mixed-provenance-interpolation.md)
  — **premise mostly wrong; one real gap and one shipped bug.** A race
  **cannot** invalidate the rest of a table: outside the TWS band it covered,
  error is unchanged and the exact grid still serves every query. Against a
  *messy* (logged) import, mixing **helps**. Pooling capture sessions with each
  other is **strictly good** (3.33 % → 2.58 % → 2.09 % as sessions accumulate).
  What is real: inside a raced band, pooling collapses that whole TWS range
  into a **single clustered column**, and the resulting answer is an
  **uncontrolled blend** at an implicit weight (~0.45) set by point counts, not
  by intent. **Decision: never pool sources** — interpolate per source, blend
  at an explicit weight with an explicit coverage rule, which needs *no changes
  to the interpolation engine*. **This amends founding decision 5: provenance
  must separate, not merely annotate.** Weight and coverage radius deferred to
  `16`. Bonus: duplicate points resolve **by row order** on the exact-TWS grid
  — a bug reachable today via CSV import — now `15`. Prototype:
  branch `prototype/03-mixed-provenance`.

- [05 — What is a sample row, and how often do we write one?](issues/05-sample-fields-and-rate.md)
  — **the row shape is settled.** Emission is **anchor-triggered** on `MWV,T`
  *or* `VHW` with a 250 ms coalesce window — which means **no native Kotlin
  tick is needed**, removing a whole native component from v1. Rows carry ~18
  columns (~1.6 MB/race, so storage is a non-argument), all angles **true-north**
  and all speeds **knots**, `twa` signed ±180° to preserve tack, **no derived
  columns** (they freeze a formula version into the data). Staleness is
  **TTL-null** at `max(1 s, 3 × period)` — measured, not guessed: the real
  GoFree capture never misses more than **one consecutive second** on any
  sentence, which also confirms `01`'s rate table empirically for the first
  time. Gaps are absent rows plus a session-level connection log and a hard 5 s
  discontinuity rule. Validation is v1, row-level for anchors and field-level
  otherwise. **`07` is now unblocked.**
- [17 — How is true wind actually derived, properly?](issues/17-true-wind-derivation.md)
  — **trust `MWV,T`; derive only as a session-level cross-check, never blended.**
  Raised inside `05` and it **inverted that ticket's working assumption**:
  deriving is not configuration-free — it needs leeway `k`, mast height and an
  upwash table. The two dominant corrections are the two we cannot reproduce —
  **upwash at 3–5° TWA per tack (a full bin)** and B&G's TWA-dependent TWS
  table (**−10 % shipped default**), both gated on an H5000 CPU. On an H5000
  boat `MWV,R` is itself back-calculated from corrected true wind, so it is not
  an independent measurement. Gives `03` a **physical** reason for never pooling
  (captured = masthead-height instrument-corrected scale, imported = 10 m
  free-stream: 5–9 % TWS and 3–5° TWA apart). Full findings:
  [research/17](research/17-true-wind-derivation.md).

- [15 — What should interpolation do when stored points collide?](issues/15-duplicate-point-collision.md)
  — **worse than ticketed: the real damage is confidence collapsing to zero,
  which disables polar-based suggestion entirely.** Duplicates inject
  zero-width gaps into the TWA axis, so `medianAxisGap` → 0 and confidence → 0
  — on **byte-identical rows**, with the speed still correct — and
  `blend.lowConfidence: 0.25` then makes ranking ignore the polar table and use
  TWA limits alone. Trigger: importing the same CSV twice. Also found that the
  four bilinear corners can come from *different* duplicate sets (lo takes the
  last duplicate, hi the first), so the surface belongs to no stored table.
  **Decision: a grid-builder invariant — a `PolarGrid` never holds two rows at
  one (TWS, TWA) node** — which kills all three defects upstream, plus exact
  equality only (never a tolerance — that is the clustered grid's job), median
  as the collapse statistic, and the row carries its contributing count `n`
  from **both** builders. **`n` is carried but deliberately not spent:**
  reinforcement was considered and dropped, because on the clustered path `n`
  is bin population and bimodal by provenance, so "`n` raises confidence"
  decodes to "captured beats imported" — `16`'s question, and a *second*
  implicit knob duplicating the blend weight, which is the exact pathology `03`
  threw out. Existing duplicate rows self-heal; no migration. New: `18`.

- [09 — The capture screen: the in-race surface](issues/09-capture-screen.md)
  — **the ticket's premise was wrong, and that is the finding: there is no
  capture screen.** The course plan must stay usable while recording, so capture
  is a **layer** — a slim always-on strip above the tab bar carrying a connection
  dot, live TWS/TWA, and the last stamp; tap it for a scrolling sail sheet.
  Nothing renders when not recording, and every scrollable screen owes it bottom
  inset. **Amends founding decision 4:** a sail is **stamped**, a bare point in
  time, never a state that holds until the next one — *forgetting to stamp must
  yield unattributed samples, never wrongly attributed ones*, which is the
  inverse of FD4 and the constraint everything downstream inherits. **Amends
  founding decision 8:** start lives on the course plan and needs a selected
  course, so the course link is no longer optional at the only entry point.
  Connection config moves to the **boat profile** and gates start (answers `11`
  q2). The notification is **status-only + Stop** — Android caps actions at
  three against a wardrobe of 8–11, and a wrong stamp is worse than no stamp;
  sail actions were *mechanically* legal (trampoline rule permits a DB-writing
  receiver) and rejected on design. Prototyping the out-of-scope live wind card
  confirmed **the scope line stands**. New: `19`. Prototypes:
  branch `prototype/09-capture-layer`.

- [07 — What counts as a steady-state stretch, and what speed do we take from
  it?](issues/07-steady-state-filter.md) — **the filter does the
  sailing-quality work, the statistic only handles noise.** Steadiness test:
  heading ±5° / boat speed ±5% / TWS ±1 kn held ≥15 s on a 3 s rolling median;
  manoeuvre exclusion is a free consequence (a tack breaks the heading band on
  its own), not a separate detector. Binning matches the clustered grid
  exactly (1 kn TWS / 4° TWA, bin centres) so proposed points land where the
  interpolator looks. Statistic is the **median**, not a percentile —
  `12`/`14`'s overstatement finding applies to *unfiltered* data; once the
  filter has excluded bad sailing, what's left is measurement noise, median's
  job. Minimum evidence **≥30 samples/bin** (~2 independent stretches).
  Outliers: per-bin **3× MAD** rejection, tentative pending `20`. Tacks
  **merge to `|TWA|`** at promotion — matches `sailPolar`'s existing unsigned
  schema, no migration; asymmetry as a calibration signal stays fog. Manual
  selection still runs the steadiness test but as a **warning, not a block**,
  then shares the same binning/median/MAD path as auto-propose. New: `20`
  (tune the MAD constant against `14`'s simulator — not blocking). Unblocks
  `08`, `09`, `10`, and `19`.

- [06 — Raw log retention and cleanup](issues/06-raw-log-retention.md) — raw
  logs are **always-on, durable-but-disposable evidence** in app document
  storage: never deleted automatically, exportable as whole files, and managed
  through visible per-recording and bulk cleanup. Deleting only a log preserves
  its recording; deleting the recording hard-deletes its entire contribution.
  Unremovable files remain discoverable as unlinked raw logs.

- [10 — The review and promotion screen](issues/10-review-and-promotion-screen.md)
  — **review is one screen per course leg, and a leg is a row of spans.** Five
  prototype rounds; the first four (a scrubbable tape, a proposal inbox, a polar
  you edit, then one screen per *tack*) were rejected as complex or as asking
  the wrong question. The unit is a **course leg, mark to mark** — 20 legs
  holding this race's 34 tacks and gybes, because nobody wants a screen per tack
  up a beat. **Legs are detectable with no course loaded**: segment on median
  **|TWA|** over ±90 s, threshold 25°, **ignoring the sign** — a tack flips the
  sign and keeps the magnitude, a rounding changes the magnitude. 14/14
  roundings, 0 spurious, median error 33 s; the **end trim absorbs that error**
  (mixed-sail legs 16/20 → 0/20), welding trim defaults to detection tolerance.
  Mark *names* still need the linked course — inferring them from roundings
  fails. Inside a leg, **every block carries a sail or nothing**, which collapses
  head-trim, tail-trim, mid-leg cuts and sail changes into one act and gives
  multiple sails per leg (the hook for **via points**). Promotion review is
  **per sail per 10° TWA band** against your existing table. The map is
  read-only and follows the pager. **`07` re-scores the yield: 45 points from a
  two-hour race, median 2 per leg, 2 legs yielding nothing** — the screen must
  read well at 1–4 points, not 11. Needed a new simulator script
  (`nmea-sim/scripts/wl-race.json`) because the old race tacked once per beat.
  Prototypes: branch `prototype/10-review-screen`, files in
  [`prototypes/`](prototypes/).

- [11 — Connection UX: finding the plotter and staying on it](issues/11-connection-ux.md)
  — **discovery first with an explicit manual mode.** Plotter setup lives on
  each boat profile and may be saved untested; automatic mode remembers a
  selected GoFree name/model and treats the latest announced endpoint as
  authoritative, while manual mode pins host/port. SailPlan never manages WiFi
  or mentions mobile data. Starting or resuming waits for valid NMEA data before
  opening the recording. On loss it retries immediately, then 1/2/5/10 s and
  every 15 s, visibly and with bounded vibration; after five minutes it
  auto-ends at the last valid sample and stops the service. That recording is
  resumable only from its notification/original course context until dismissed,
  superseded or confirmed; resume reopens the same recording and preserves the
  outage as a gap. Ambiguous discovery never switches sources in the background.

- [What does a sparse sail stamp actually claim?](issues/19-stamp-attribution-rule.md)
  — a stamp is a **point observation** that seeds draft, leg-based attribution;
  local `|TWA|`/TWS similarity may carry it one adjacent leg, while sustained
  speed changes find boundaries rather than identify sails. **Next/Finish**
  confirms the visible blocks, and only confirmed spans enter the steady-state
  filter; uncertain samples remain recorded but not used.
- [Should re-importing the same CSV be prevented?](issues/18-duplicate-import-prevention.md)
  — yes, at both whole-batch and partial-observation level: canonical
  fingerprints ignore formatting differences, timestamped observations already
  contributed by earlier import batches are skipped with explicit UX, and each
  successful import is a removable **polar import batch**. Legacy, manual and
  captured rows are deliberately outside duplicate matching.

- [Tune the steady-state filter's outlier-rejection threshold](issues/20-tune-outlier-threshold.md)
  — measured **4× raw MAD**, replacing the tentative 3×: it catches essentially
  all gross speed spikes at both 30 and 200 samples while rejecting materially
  fewer non-glitch observations; use a 0.1 kn scale floor for quantised bins.

- [Schema and domain model](issues/08-schema-and-domain-model.md) — **evidence is
  immutable, claims are mutable, and provenance is a predicate not a
  relationship.** Nine tables plus four columns on `sailPolar`. Samples and
  stamps are written once; **sailed legs and sail-attribution spans claim time
  ranges over them** (`[startTime, endTime)`, no span id on any sample), so
  dragging a divider in review never rewrites 400 rows and "not used" needs no
  representation — a sample in no span is unattributed. `sailPolar` gains
  `sourceKind` ∈ {`manual`, `import`, `capture`}, so `03`'s never-pool rule is
  the single predicate `sourceKind = 'capture'`; `legacy` was proposed and
  dropped by Logan (sole user, nothing imported, so the unknown isn't unknown).
  Vocabulary: the artifact is a **capture session** (one start→stop, ideally one
  race but not enforced), *recording* is demoted to the verb, and **`sailedLeg`**
  is a new term because `10`'s |TWA|-detected legs are *observed* while
  `CONTEXT.md`'s legs are *planned*. Lifecycle is three durable states with
  resumability derived. Integrity follows the house convention — no cascades, no
  `PRAGMA foreign_keys`, explicit fan-out in `api/`. **Migration is the
  non-routine part: two, deliberately ordered**, because adding a foreign key
  makes drizzle-kit rebuild `sailPolar` and a same-migration new column breaks
  the copy statement, behind a `MigrationGate` that blocks app startup. General
  rule written up in
  [`docs/data-layer.md`](../../sailplan-app/docs/data-layer.md#adding-a-foreign-key-rebuilds-the-whole-table).
  No new tickets; nothing graduates from the fog.

### Founding decisions

Settled while charting, before any ticket existed. Recorded here because they
have no ticket of their own; everything after this point gets one.

1. **Scope** — record → review → promote. Nothing live. See
   [Out of scope](#out-of-scope).
2. **Persistence** — normalised samples in SQLite; the raw sentence stream to a
   file via `expo-file-system`, never in the DB. Samples are cheap (~500 KB per
   race at 1 Hz); the raw log is the only thing that needs a retention policy.
3. **Sampling** — capture near the device's native rate and average at
   *analysis* time, so the averaging window can be chosen per use rather than
   baked into the recording. Exact rate pending `01`.

   ✅ **Settled by `05`.** 1 Hz, emitted **event-driven** on the arrival of
   `MWV,T` or `VHW` with a 250 ms coalesce window — not on a clock. The
   coalesce window is what stops two anchors turning a 1 Hz recording into
   2.4 Hz of near-duplicates weighted by sentence timing rather than by time.
4. **Sail attribution** — a timestamped **assertion** ("sail X is up right
   now"), *not* a change-event. An assertion holds until the next one. Fully
   editable after the fact. Inferring the true boundaries around an assertion
   is fog, not a commitment.

   ⚠️ **Amended by `09` — "holds until the next one" is reversed.** A sail is
   **stamped**: a bare point in time, tapped opportunistically and often
   forgotten, that **does not propagate forward**. Forgetting to stamp after a
   swap must leave samples *unattributed*, never *wrongly attributed* — silent
   misattribution poisons a polar, an unattributed stretch merely wastes it.
   That inverts the safety property FD4 assumed. It also drags the "boundary
   inference" fog out of the fog: with sparse stamps the inference **is** the
   mechanism by which a session becomes polar points, not a later nicety. Owned
   by [What does a sparse sail stamp actually claim?](issues/19-stamp-attribution-rule.md).
   Editability after the fact is unchanged and now matters more (`10` q3).
5. **Provenance** — `sailPolar` gains a source column pointing back at the
   capture session, so promotion is reversible and measured points are
   distinguishable from imported ones.

   ⚠️ **Amended by `03`.** The column is **load-bearing for separation**, not
   just annotation: imported and captured points are never pooled into one
   point set. Each source is interpolated on its own grid and the two answers
   blended at an explicit weight, with measured contributing only where it has
   coverage. Capture sessions still pool with *each other* — the rule applies
   only at the imported/captured boundary.
6. **Reliability** — recording must survive the screen being off, so an Android
   **foreground service** is a v1 requirement, not an enhancement. Gated by
   `02`.
7. **Derivation** — two paths, both required: auto-propose (steady-state filter
   → TWS/TWA bins → a summary statistic) with confirmation before writing; and
   fully manual stretch selection as the fallback when the proposals look
   wrong.

   ✅ **Settled by `07`.** Not a percentile — **median**, taken after a
   steadiness filter (heading ±5° / boat speed ±5% / TWS ±1 kn held ≥15 s) has
   already excluded badly-sailed stretches, so the statistic only has to
   handle residual measurement noise rather than also doing the sailing-quality
   work a percentile was trying (and, per `12`/`14`, failing) to do. The
   two-path structure (auto-propose + manual fallback) is unaffected; manual
   selection shares the same statistic, just with the steadiness test
   downgraded to a warning.
8. **Session shape** — belongs to a boat profile; carries name, start/end,
   notes, and an **optional** course link (optional so a casual sail can still
   be recorded). Conditions are derived from the captured data. No competitors,
   no results.

   ⚠️ **Under pressure from `09`.** Recording starts from the **course plan**
   and needs a selected course, so at the only entry point that exists the
   course link is **mandatory**. Either casual course-less recording is dropped
   or a second entry point is needed — see
   [Not yet specified](#not-yet-specified). `09` also adds a hard precondition
   the session shape did not have: **the boat profile must carry a plotter
   endpoint** or recording cannot begin at all.
9. **Development is simulator-first** — the feature must be buildable and
   testable on a desk. See the boat-access constraint in
   [Notes](#notes) and ticket `12`.

- [13 — Device spike: prove the screen-off capture survives a race](issues/13-device-spike-background-capture.md)
  — **founding decision 6 stands — no code changes needed.** A
  `connectedDevice` foreground service (`react-native-background-actions` +
  `react-native-tcp-socket`, fully event-driven off socket `data`, no JS
  timer on the path) survives genuine backgrounding, deep Doze and the
  restricted standby bucket on real hardware; writes never drop between
  emission and SQLite even at twice race volume. A multi-session "samples
  thin under sustained backgrounding" scare turned out to be a **desk-rig
  artifact**: a controlled A/B (packet capture running on the test AP's
  interface vs not, four dead runs vs two healthy ones, confirmed by
  reproducing the death the moment the capture was removed) points at this
  box's own NetworkManager/hostapd hotspot, not the phone's radio or
  Android's power management — `04`/`21` should watch for the same shape
  against the Zeus 3's real AP as a confirmation step, but nothing blocks on
  it. One real, separate finding carries forward as an implementation risk,
  not a design change: a reproducible Android ANR on **resume** (5s after
  `app_state → active`), cause not yet root-caused. Also: the no-route
  failure `11` needs to detect costs **31s** on this stack, and
  `interface: 'wifi'` OFF fails the no-internet trap non-deterministically
  (ON still reliably fixes it). Full findings, the stack, and the
  `app.config.js`/manifest diff: the ticket's Answer.

## Not yet specified

- **Instrument calibration.** A miscalibrated wind vane or boat-speed paddle
  produces polars that are confidently wrong. Whether the app should detect,
  correct, or merely warn about this is open — flagged as a real risk, but not
  something to solve before there's any data at all. **`01` sharpened this
  twice:** the Zeus 3's manual states that boat-speed and other offsets entered
  on the plotter apply *only to that unit* and are not propagated to the
  network, and it is undocumented whether the Ethernet stream carries
  calibrated or raw bus values. Separately, NMEA 0183 cannot express whether
  true wind is water- or ground-referenced — the latter bakes tidal current
  into every polar. The reference-frame question is now sharp enough to be
  owned by `05` and measured by `21`; the wider calibration question stays
  here. **`03` measured the cost of leaving it unsolved:** a session recorded
  with a +6 % boat-speed error is not rejected by pooling, it is *averaged in
  proportionally* — one bad session in three drags fleet bias from −0.72 % to
  +1.12 % and flips its sign. Median binning is robust to outliers, and
  calibration drift is not an outlier; it is a coherent offset the median moves
  along with. Deliberately left as fog (Logan, this session) rather than
  ticketed, but it means the useful thing about session provenance is being
  able to take a session back *out*. **`17` has now sized it:** the single
  largest unmodelled term is **upwash, at 3–5° of TWA per tack — a full 4° bin**
  — and it is *not* something the app can fix; it is fixed by a calibration the
  boat's owner has to sail for, on hardware (an H5000 CPU) that may not be
  aboard. Heel (+1.8° TWA, +2.7 % TWS at 20°) and wind gradient (+2.4 % to
  +9.1 % TWS) are the next terms; `05` now stores `heel`/`trim` on every row so
  a later decision to correct doesn't require re-recording every session.
  Related: `17` also could not establish **whether B&G folds leeway into
  transmitted TWA** or keeps it heading-relative — worth up to ~4°, another
  full bin. **`07` adds one more thread:** port/starboard asymmetry at
  promotion is the cheapest available signal for this fog, but `07` merges
  tacks to `|TWA|` to match `sailPolar`'s existing unsigned schema, so
  surfacing that signal (as an analysis step, not a stored asymmetry) is left
  here rather than solved by promotion.
- **Which wind frame the Plan tab speaks.** Forecast wind is *meteorological* —
  ground-referenced — but polars are built from instrument true wind, which for
  performance purposes should be water-referenced. So the TWD a user types on
  the Plan tab and the TWD their polars were derived from may be in different
  frames, differing by the tidal current vector. Surfaced while resolving `05`;
  deliberately left as fog because it only bites in a tideway and the size of
  the bite is unknown until `21` classifies a real session.
- **Generating `sailTwaLimit` rows from captured data.** The same tracks that
  yield polar points also reveal the angles a sail was actually usable at. An
  algorithm could propose limit rows or flag existing ones as wrong. Wanted
  eventually; deliberately not sized yet.
- **Whether a course-less session can be recorded at all.** `09` puts the only
  start control on the course plan, behind a selected course, which contradicts
  founding decision 8's deliberate optionality. Fog rather than a ticket because
  it may resolve itself: if the casual case turns out not to matter to Logan,
  FD8 simply changes. If it does matter, it needs a second entry point and that
  is a design question. Revisit once `10` decides where sessions are listed —
  that screen is the obvious second home for a Start control.
- **Battery and thermal behaviour** over a 3-hour recording.
- **Session export / sharing** — the app already has CSV import/export for
  polars; whether sessions get the same treatment.

## Out of scope

Ruled beyond this destination. Returns only as a fresh effort.

- **Live telemetry on the Plan tab** — auto-filling TWD/TWS from the feed
  instead of typing them. A whole second product surface: connection
  lifecycle, staleness UX, failover.
- **Live on-water performance feedback** — target speed / percentage-of-polar
  against the current TWA/TWS. Explicitly the next thing wanted after this
  map, and it depends on this map producing good polars first.
- **Race scoring** — competitors, finish times, results.
- **Fixing the polar CSV import's silent knots assumption.** Found while `05`
  established the canonical storage unit: CSV import is the only writer that
  doesn't convert. Real but unrelated to this destination, and not blocking
  `07` — logged as repo tech debt at
  [`.tickets/tech-debt/issues/01-csv-import-assumes-knots.md`](../tech-debt/issues/01-csv-import-assumes-knots.md).

## Tickets

Open tickets are found by scanning `issues/`; this list is not maintained.

- Charting: frontier was `01`, `02`, `03`, `12`.
- After the research round (`01`, `02`, `12` resolved): frontier was `03`,
  `04`, `05`, `06`, `09`, `11`, `14`.
- After `14`: frontier was `03`, `04`, `05`, `06`, `09`, `11`, `13`.
- After `03`: frontier was `04`, `05`, `06`, `09`, `11`, `13`, `15`.
- After `05` (and `17`, raised and resolved inside it): frontier is `04`, `06`,
  `07`, `08`, `09`, `10`, `11`, `13`. Resolving `05` unblocked **three** tickets
  — `07`, `08` and `10`. (`15` was resolved concurrently in another session.)
  - **`07` is the one to take next** — `05` was the last thing between it and a
    decision, and it has had measured evidence waiting since `14`.
  - `06` now inherits a constraint: sample rows carry a `rawOffset` into the raw
    log, so a retention policy that deletes the log dangles them.
  - `08` takes `05`'s field list as the sample table's shape, plus the
    session-level columns `05` §6 and §5 introduce (wind classification, reject
    counters, stale counters, connection events).
  - `13` is where the `hotspot.sh` rig gets its first end-to-end run with a
    real phone.
  - `16` is new from `03` but **blocked by `04`**: the blend weight can only be
    chosen against real captured data. `15` has now handed it a second job —
    deciding whether the node count `n` is allowed to influence confidence at
    all, which is the same captured-vs-imported trust question as the weight.
- After `15`: frontier gains `18`.
  - `18` is new from `15` and cheap — duplicate-import prevention. **Take it
    before `08`**: its question 3 decides whether imports become first-class
    batch records, which is `08`'s provenance-column shape. Deciding it
    afterwards means a second migration.
  - `15` also leaves a **code fix outside this map** — the grid-builder
    invariant, the IDW `EPSILON` one-liner, and tests. A shipped bug that
    should not wait on the spec being finished; raise it as an ordinary
    `.tickets/` implementation issue.
  - `04` is technically unblocked but needs the boat; per the access
    constraint above, nothing waits on it — and after `14`, less than ever.
    It now also gates `16`.
  - `06`, `09` and `11` remain takeable with no dependencies on hardware.
- After `09`: frontier is `04`, `06`, `07`, `08`, `11`, `13`, `16`(boat), `18`,
  plus `10` (claimed, prototype built and awaiting a phone). New: `19`, blocked
  by `05` and `07`.
  - **`11` is the one to take next.** `09` handed it a decided answer to its
    question 2 (endpoint lives on the boat profile) and a new gating rule, and it
    is the last unblocked design ticket standing between the surface decisions
    and a writable spec.
  - `19` is where founding decision 4's amendment gets its mechanism. It is
    blocked by `07`, which owns the other rule that cuts a session into
    stretches — resolve `07` first and check whether the two compose or one
    subsumes the other.
  - `08` gains two shapes from `09`: a **stamp** table that must not be able to
    express an interval, and plotter connection columns on `boatProfile`.
  - `10`'s question 3 is now load-bearing rather than a convenience: under
    sparse stamping, review-time correction is how a forgotten swap gets fixed.
- After `07`: frontier is `04`, `06`, `08`, `11`, `13`, `16`(boat), `18`, `19`,
  `20`, plus `10` (claimed, prototype built and awaiting a phone).
  - `19` is now fully unblocked (`05` and `07` both resolved) — it owns
    exactly the question `07`'s answer flagged but didn't settle: whether the
    steadiness filter and the stamp-attribution rule compose or one subsumes
    the other.
  - `20` is new from `07` and cheap — tunes the steady-state filter's 3× MAD
    outlier constant against `14`'s simulator. Not blocking; nothing else on
    the map waits on it.
  - `08` now also inherits `07`'s promoted-point shape (bin centre, `n`,
    MAD-filtered median) alongside `05`'s sample-row shape and `09`'s stamp
    table.
- After `10`: frontier is `04`(boat), `08`, `13`, `16`(blocked by `04`), `18`,
  `19`, `20`, plus `11` (claimed).
  - **`19` is the one to take next.** `10` reshaped its question rather than
    answering it: attribution is now "which **span** of which leg does a stamp
    claim", with real edges at mark roundings instead of a decay in time, and
    `10` measured that a stamp **must cross manoeuvres** (5 of 17 legs had no
    stamp; every one was the leg after a tack; carry-forward scored 5/5). The
    ticket carries a note block saying what to re-read.
  - `08` gains a third shape from `10`: a **leg** is now a first-class thing the
    review screen works in — detected on |TWA|, divided into spans that each
    carry a sail or nothing. Whether legs and spans are *stored* or recomputed
    on open is `08`'s call, and it decides whether a review can be resumed.
  - `16` inherits `10`'s band-edge finding: the promotion review shows the
    largest deltas exactly where the stored table is weakest, so the coverage
    rule needs to surface as a confidence cue, not just gate the blend.
  - Everything left is either the boat (`04`, and `16` behind it), the device
    spike (`13`), or small and unblocked (`18`, `20`).
- After `11`: frontier is `04`(boat), `08`, `13`, `18`, `19`, `20`; `16`
  remains blocked by `04`.
  - **`19` remains the next design decision.** `11` closes the whole connection
    surface without putting the boat on the critical path.
  - `08` now owns the persisted shapes for automatic-vs-manual plotter setup
    and the active / deliberately-ended / auto-ended-resumable / confirmed
    recording lifecycle. A saved setup is configuration, never runtime
    reachability.
  - `13` must validate WiFi binding, screen-off reconnect, notification and
    vibration escalation, and five-minute service shutdown. Automatic-mode
    desktop tests need the simulator or a companion to emit GoFree discovery
    announcements; this is implementation work, not another decision ticket.
- After `08`: frontier is `04`(boat), `13`, `18`, `20`; `16` remains blocked by
  `04`. **`08` was the last unblocked design decision** — every persisted shape
  the spec needs now exists.
  - `18` and `20` are resolved; what is left on the map is the boat (`04`, and
    `16` behind it) and the device spike (`13`). Neither produces a decision the
    spec is waiting on — `04` is a confirmation step that may force revisions,
    `13` is hardware validation.
  - **The destination is within reach: the next act is writing
    `.tickets/nmea-ingestion/spec.md`** from the twelve resolved tickets, not
    taking another ticket.
  - `16` still cannot be decided without real captured data, so the blend weight
    stays open past the spec — the spec should say so explicitly rather than
    inventing a placeholder weight.
- **`04` re-cut into two tickets** (scoping act, not a decision on the route).
  Boat access turned out to have two shapes, not one: a **30-minute dockside
  visit** where the boat cannot leave the berth, and a **race day** with a
  ~1 hour motor each way either side of the racing. The original ticket assumed
  a single undifferentiated trip and bundled all 24 verify items into it.
  - [`04`](issues/04-capture-raw-sample-on-boat.md) is now the **dockside
    go/no-go set** — 22 of the 24 items, including all four damage-ordered
    dominators (does the WiFi module emit at all, does Android get DHCP, is
    `MWV,T` populated, does the Serial-output checkbox gate Ethernet). It fits
    in 30 minutes only because the capture runs while the menus are
    photographed.
  - [`21`](issues/21-race-day-capture.md) is new: the **on-water half**. Three
    items are unanswerable at a fixed berth — water- vs ground-referenced
    `MWV,T`, the ⭐ tack-to-tack calibration split, and paddlewheel liveness
    (a dead paddle and a stationary boat both read `0.00`). The motor out takes
    the slow menu items 30 minutes cannot hold; the pre-start warm-up takes the
    ⭐ measurement deliberately rather than hoping the race supplies it.
  - **`16`'s blocker moved from `04` to `21`.** Dockside data cannot serve it:
    no boat speed means no polar points to weigh.
  - **`04` is a phone-only trip — no laptop** (Termux on the Zenfone 10, Android
    15). The phone is better evidence than a laptop anyway, being the actual
    target device. One consequence, decided rather than deferred: **`01` item 11,
    multicast GoFree discovery, goes unverified.** Termux cannot hold a
    `MulticastLock`, so a negative result would be uninterpretable. Manual mode
    — already a first-class path in `11`, and needed regardless — gets built
    first, and `21` becomes the real discovery test using app code that *can*
    hold a lock. This decides whether the user ever types an IP, not whether the
    feature works.
  - **`13`'s device assumption was wrong in our favour.** It expected the
    Zenfone 10 to top out at Android 13 (API 33), making the emulator the only
    place the target API level got tested; it is on **Android 15 (API 35)**, so
    the Android 15 `dataSync` 6 h/24 h cap is now testable on real hardware.
    Ticket corrected. Open thread: `app.config.js` sets no explicit
    `targetSdkVersion`, so whether Expo SDK 55 targets 35 or 36 is a
    prebuild-time check.
  - **Neither ticket blocks building.** `04` was always a confirmation step and
    after `14` the boat left the critical path entirely; `16` is a promotion
    decision that wants the race data anyway. The real gate on recording a race
    is `13` — founding decision 6 rests on inference until the foreground
    service is proven on hardware, and that is a desk/emulator problem.
  - **A raw log is lossless** (FD2 + `05`: samples are derived from the sentence
    stream), so the minimum useful build is connect → timestamped raw file →
    survive screen-off. Everything downstream can be built later and replayed.
    An independent third-party TCP logger carried as a fallback makes a failed
    first outing cost nothing.
- After `13`: frontier is `04`(boat), `16`(blocked by `21`) — nothing else.
  **`13` was the last non-boat ticket on the map.** Founding decision 6 is
  confirmed on hardware with no code changes implied; the multi-session
  "thinning" scare resolved as a desk-rig artifact rather than a phone or
  Android limitation, via a controlled A/B rather than inference. Everything
  left needs the water: `04`, `21`, and `16` (blend weight, blocked behind
  `21`). **The destination — `.tickets/nmea-ingestion/spec.md` — can be written
  now**; `04`/`21` are confirmation steps, not gates on it.
- **`04` re-cut a second time, and `21`'s blocking edge cut** (scoping act, not
  a decision on the route). Boat access before Saturday can no longer be
  assumed, so the standalone midweek dockside visit is **gone** — not deferred,
  removed from the plan. `04` now has two halves that are not a special trip:
  a **desk half** this week (Termux, `capture.py` against `nmea-sim`, the
  five-minute wakelock test) and a **berth half at ~08:00 Saturday**, ~10–15
  minutes of the four damage-ordered dominators before slipping. `21` no longer
  reads `Blocked by: 04`; the two share a day and a log file.
  - **The map already licensed this.** The boat-access constraint in
    [Notes](#notes) forbids the water sitting on the critical path, `14` took
    the boat off it entirely, and after `08` no design decision waited on `04`.
    Per FD2 and `05` the **raw log is lossless**, so a race survives in one
    timestamped file whatever the app does.
  - **What it costs: the go/no-go answers now arrive after the build, not
    before.** Four risks land on race morning instead of midweek — the
    Serial-output checkbox gating the stream (zero bytes at 08:00), an endpoint
    unknown until the day, `MWV,T` absent or status `V` (a raw log but no polar
    points), and a link-local address instead of a DHCP lease. All four are
    recoverable *at the berth* with the ticket to hand; none is recoverable once
    the lines are off. Ranked and written up in `04`.
  - **Two build requirements fall out of it, both qualifying `11`.**
    **Raw-first, parse-second**: `11`'s "wait for valid NMEA data before opening
    the recording" must gate the *sample pipeline*, not the *file* — open the
    raw log the instant the socket connects, or an unpredicted sentence set can
    refuse to record a race. And **soften `11`'s five-minute auto-end** for this
    build, since a dropout no dock visit has characterised would otherwise end a
    race recording silently. Whoever writes the spec should carry both.
  - **`capture.py` in Termux is promoted from bonus to primary insurance.** It
    is now the only capture path that will have been exercised against a real
    stream before race morning; the app's own capture runs for the first time
    ever on the water. The desk half is therefore **not optional** — the
    simulator test *is* the rehearsal.
  - **The dock trip's diagnostic half was not lost, only relocated.** Wind
    source, SOG-as-boat-speed / COG-as-heading, damping, H5000 correction
    tables and mast height are diagnostics for *interpreting* data, not gates on
    recording it, and `21`'s unhurried motor-out hour already held them.
  - **Nothing on the route changed.** No decision was made or unmade here; the
    spec is unaffected, and `16` stays blocked behind `21` exactly as before.
