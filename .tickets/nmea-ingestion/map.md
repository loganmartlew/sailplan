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
  simulator (`12`), and the on-boat ticket (`04`) is a **confirmation** step
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

   ⚠️ **The "high percentile, not mean" part of this decision is now in
   question, and there is now a measurement.** `12` computed that a
   90th-percentile derivation overstates the polar by ~8.3% against the
   project's own noise model, because a percentile over a noisy bin measures
   *instrument noise*, not sailing skill. `14` then measured it end to end and
   found the overstatement is **~+3.1% once trim is autocorrelated the way a
   real boat's is**, with **p75 nearly unbiased (+0.9%)** and mean/p50 running
   *negative*. `07` owns the choice and now makes it from a table, not from
   taste. The two-path structure is unaffected.
8. **Session shape** — belongs to a boat profile; carries name, start/end,
   notes, and an **optional** course link (optional so a casual sail can still
   be recorded). Conditions are derived from the captured data. No competitors,
   no results.
9. **Development is simulator-first** — the feature must be buildable and
   testable on a desk. See the boat-access constraint in
   [Notes](#notes) and ticket `12`.

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
  owned by `05` and measured by `04`; the wider calibration question stays
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
  full bin.
- **Which wind frame the Plan tab speaks.** Forecast wind is *meteorological* —
  ground-referenced — but polars are built from instrument true wind, which for
  performance purposes should be water-referenced. So the TWD a user types on
  the Plan tab and the TWD their polars were derived from may be in different
  frames, differing by the tidal current vector. Surfaced while resolving `05`;
  deliberately left as fog because it only bites in a tideway and the size of
  the bite is unknown until `04` classifies a real session.
- **Generating `sailTwaLimit` rows from captured data.** The same tracks that
  yield polar points also reveal the angles a sail was actually usable at. An
  algorithm could propose limit rows or flag existing ones as wrong. Wanted
  eventually; deliberately not sized yet.
- **Boundary inference for sail assertions** — deriving when a sail actually
  went up/came down from step-changes in the data, rather than trusting the
  assertion timestamp.
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
