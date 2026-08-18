# Spec: NMEA data ingestion

Status: ready-for-agent
Map: [map.md](map.md)

Synthesised from the twelve resolved tickets on
[`map.md`](map.md) — `01`, `02`, `03`, `05`, `06`, `07`, `08`, `09`, `10`, `11`,
`12`, `13`, `14`, `15`, `17`, `18`, `19`, `20`. Every decision here was settled
on one of those tickets; this document assembles them and adds nothing that was
not decided, except where explicitly marked **(spec call)**.

Read [`CONTEXT.md`](../../CONTEXT.md) first. This spec uses its vocabulary
throughout — **capture session**, **capture sample**, **sailed leg**, **sail
stamp**, **sail-attribution span**, **raw log**, **NMEA source**, **plotter
setup**, **NMEA connection**, **polar import batch** — and means exactly what
that glossary says.

---

## Problem Statement

Logan's boat carries a B&G Zeus 3 that already knows, second by second, how fast
the boat is going at what true wind angle in what true wind speed. SailPlan's
sail suggestions are only as good as the polars behind them, and today those
polars are hand-entered guesses — the boat's own measured performance never
reaches the app.

Closing that gap by hand is not realistic. Nobody is going to sit at a chart
table writing down TWS/TWA/speed triples while racing, and even if they did, most
of a race is not usable polar data: tacks, gybes, acceleration out of manoeuvres,
luffing for the start, sitting in dirty air, and simply sailing the boat badly
all produce speeds that must not enter a polar. The data that matters is the
handful of stretches where the boat was settled and going well, and finding those
by eye across two hours of sailing is worse than the problem it solves.

There is a second, quieter problem underneath it. The one thing the sailor *does*
have to supply is which sail was up — the instruments cannot know that — and
racing is exactly when there is no attention to spare. A scheme that assumes the
sailor reliably records every hoist and drop will silently attribute one sail's
numbers to another, and a polar built from misattributed data is confidently
wrong in a way that is worse than having no polar at all.

## Solution

Three acts, cleanly separated: **record**, **review**, **promote**.

**Record.** Once a boat profile has plotter setup, the course-plan screen offers
`Record this course`. SailPlan connects to the NMEA source over TCP, opens a raw
log, and starts writing capture samples at 1 Hz into a capture session. Recording
survives the screen being off and the phone being pocketed, via an Android
foreground service. While recording, a slim capture layer sits above the tab bar
on every screen — connection dot, live TWS and TWA, the last sail stamp and its
age — so the sailor keeps using the course plan exactly as before, and a dead
feed is never silent. Declaring the sail is two taps into a stamp: *this sail was
up at this instant*. A stamp is a bare observation and never propagates forward,
so forgetting one costs unattributed data, never misattributed data.

**Review.** Afterwards, sitting down, the sailor pages through the session one
**sailed leg** at a time — detected from the boat's own data on median `|TWA|`,
with mark names filled in from the linked course. Each leg is a row of
**sail-attribution spans**, each carrying one sail or nothing, opening on
sensible defaults that trim the hoist and the drop. Trimming an end, cutting a
bad patch out of the middle, and changing sail mid-leg are all the same act:
moving a divider. Advancing the pager confirms the leg.

**Promote.** From the confirmed spans, SailPlan finds the genuinely steady
stretches — heading, boat speed and TWS all held inside tight bands for at least
15 seconds — bins them exactly the way the interpolator will later look for them,
and takes a robust median per bin. The sailor sees the result as a comparison
against their existing table, per sail, per 10° TWA band, before anything is
written. Promoted points carry their capture session, so a session can be taken
back out whole. On the read side, measured points are never pooled with imported
or hand-entered ones: each source is interpolated on its own grid and the answers
blended at an explicit, named weight where measured data has coverage.

## User Stories

### Plotter setup and connection

1. As a sailor, I want to store my plotter's connection details against a boat
   profile, so that switching boats switches which plotter SailPlan expects.
2. As a sailor, I want SailPlan to discover NMEA sources on the boat's network
   automatically, so that I never have to find an IP address on a chartplotter
   menu.
3. As a sailor, I want each discovered NMEA source listed by name and model with
   its address as secondary detail, so that I recognise my own plotter rather
   than decoding a list of hosts.
4. As a sailor with a simulator, a non-GoFree gateway, or an unusual network, I
   want to pin a host and port manually, so that discovery can never silently
   move me off it.
5. As a sailor, I want to save plotter setup while the plotter is switched off,
   so that I can configure the app at home the week before the race.
6. As a sailor, I want an optional **Test connection** that shows either
   `Not tested` or the last successful test time, so that I can tell the
   difference between "configured" and "known to work".
7. As a sailor whose plotter was assigned a new address, I want automatic mode to
   follow the freshly announced endpoint, so that DHCP churn does not break
   recording.
8. As a sailor with two matching sources on the network, I want SailPlan to ask
   me which one rather than guessing, so that it never records from the wrong
   boat's instruments.
9. As a sailor on boat WiFi with no internet, I want SailPlan to reach the
   plotter anyway, so that Android's preference for a working mobile connection
   does not cost me the race.
10. As a sailor, I want SailPlan to never join, switch, or store WiFi
    credentials, and never mention mobile data, so that the app stays out of a
    part of the phone I already manage.
11. As a sailor who cannot connect, I want failure copy that distinguishes "not
    on boat WiFi" from "on WiFi, plotter not found", so that I know which thing
    to go and fix.
12. As a sailor, I want a route from the failure state straight to Android's WiFi
    settings and back, so that fixing the obvious cause takes one tap.

### Starting a recording

13. As a sailor, I want to start recording from the course plan I am already
    looking at, so that the session knows which course I am sailing without my
    telling it twice.
14. As a sailor with no plotter setup on the active profile, I want the start
    control replaced by **Set up plotter** deep-linked to the right screen, so
    that I am never offered an action that cannot work.
15. As a sailor, I want SailPlan to connect and wait for real NMEA data before
    the recording opens, so that I am never left with an empty session I have to
    clean up.
16. As a sailor whose connection attempt fails, I want to stay on the course plan
    with **Retry**, **Open Wi-Fi settings** and **Plotter setup** offered, so
    that no half-formed recording is created.
17. As a sailor, I want the raw sentence stream written to disk from the instant
    the socket connects, so that an unexpected sentence set costs me polar points
    but never the race itself.

### While recording

18. As a sailor, I want the course plan to stay fully usable while recording, so
    that capture never takes the screen away from the job I am actually doing.
19. As a sailor, I want a slim always-on strip above the tab bar carrying
    connection state, live TWS and TWA, and the last stamp, so that one glance
    tells me it is genuinely working.
20. As a sailor, I want live numbers rather than only a status dot, so that a
    frozen-but-connected feed cannot masquerade as a healthy one.
21. As a sailor, I want every scrollable screen to scroll far enough that the
    strip never permanently covers the last leg card, so that recording does not
    cost me part of the app.
22. As a sailor, I want nothing at all rendered when I am not recording, so that
    the app is exactly itself the rest of the time.
23. As a sailor, I want to declare the sail in two taps — strip, then sail — so
    that stamping is cheap enough to actually do while racing.
24. As a sailor, I want the sail sheet to be a grid of large colour-coded targets
    that scrolls, so that a wardrobe of more than eight sails still works
    one-handed.
25. As a sailor who tapped the wrong sail, I want an undo toast for a few
    seconds, so that an obvious mis-tap is fixed in the moment rather than in
    review.
26. As a sailor, I want the last stamp shown explicitly as history with its age,
    turning amber past fifteen minutes, so that I am nudged to stamp without ever
    reading it as a claim about now.
27. As a sailor who forgot to stamp after a sail change, I want the affected
    samples left unattributed, so that my polars are never quietly poisoned by
    the wrong sail.
28. As a sailor, I want stopping to require a deliberate hold, so that the
    recording cannot be ended by a brush of a wet hand.
29. As a sailor with the phone in a pocket and the screen off, I want recording
    to continue unaffected, so that a three-hour race records without my
    attention.
30. As a sailor, I want a persistent notification showing live TWS and TWA,
    sample count and time since the last stamp, so that I can check on the
    recording from the lock screen.
31. As a sailor, I want **Stop** as the notification's only action, so that under
    load I cannot fat-finger a wrong sail from a shortlist that could never hold
    my whole wardrobe anyway.

### Losing and regaining the connection

32. As a sailor, I want the live values to grey out and a **Retrying** bar to
    appear the moment data stops, so that a dead feed is never silent.
33. As a sailor, I want the notification to change to **Connection lost —
    retrying** immediately, so that the failure is visible without unlocking the
    phone.
34. As a sailor, I want a distinct vibration shortly after the loss and one
    reminder a minute later, but no repeated buzzing, so that the alert is
    noticed without becoming noise I learn to ignore.
35. As a sailor, I want one short confirmation vibration when data returns, so
    that I know it recovered without looking.
36. As a sailor, I want SailPlan to keep retrying on a backoff rather than giving
    up quickly, so that a plotter reboot or a walk to the foredeck does not end
    my race.
37. As a sailor whose connection recovers, I want the same capture session
    continued with the outage preserved as a gap, so that the recording is one
    race rather than two fragments.
38. As a sailor whose feed is gone for good, I want the recording auto-ended at
    the last valid sample with everything captured preserved, so that the
    foreground service does not run all night after I switch the instruments off.
39. As a sailor whose recording auto-ended while I was still aboard, I want
    **Resume recording** offered from the notification and the original course
    plan, so that a long dropout does not force me to start a second session.
40. As a sailor, I want the resume offer to disappear once I dismiss it, start
    another recording, or confirm that session's data, so that it never
    reappears months later out of context.
41. As a sailor who stopped a recording deliberately, I want no resume offer at
    all, so that "stop" means stop.

### Reviewing a session

42. As a sailor, I want past capture sessions listed by date with duration,
    sample count and wind range, so that I can find the race I am thinking of.
43. As a sailor, I want a session that captured nothing usable to open to a plain
    explanation rather than an empty screen, so that I know whether to blame the
    boat, the network, or the wind.
44. As a sailor, I want review to page through my sailed legs, so that I judge
    the race in units I would say out loud rather than in bins I have no
    intuition for.
45. As a sailor, I want legs detected from the boat's own data even when no
    course was linked, so that review works for a session I did not plan as a
    course.
46. As a sailor, I want a tack or gybe inside a beat to stay inside one leg, so
    that I am not asked to judge thirty-four screens for one race.
47. As a sailor with a linked course, I want each leg titled by the marks it ran
    between, so that I recognise it instantly.
48. As a sailor with no linked course, I want legs named by point of sail — Beat
    3, Run 3 — and renameable, so that I can still tell them apart.
49. As a sailor, I want each leg to open already trimmed at both ends, so that the
    hoist, the drop and the leg-detection error are excluded by default rather
    than by my remembering to exclude them.
50. As a sailor, I want to cut a bad patch out of the middle of a leg, so that
    sailing through a wind hole or someone's dirty air does not have to cost me
    the whole leg.
51. As a sailor who changed sail mid-leg, I want to split the leg and assign each
    part its own sail, so that a peel does not force me to discard the leg.
52. As a sailor, I want trimming, cutting and sail-changing to be the same
    action, so that there is one mechanism to learn instead of four.
53. As a sailor, I want to drag a divider or nudge a selected block's edges by
    small fixed steps, so that I can be precise on a phone.
54. As a sailor, I want deleting a divider to merge the blocks back together, so
    that every edit has an obvious undo.
55. As a sailor, I want a block *carrying a sail* that is too short to produce
    anything to say so, so that I do not carefully trim something that was never
    going to count. An unattributed or no-data block stays quiet — it was never
    going to contribute, and saying so on every one of them is noise.
56. As a sailor, I want a read-only map that follows the pager and draws each
    span in its own colour, so that I can recognise the leg on the water without
    the map becoming another thing to navigate.
57. As a sailor, I want to toggle the map between this leg and the whole course,
    so that I can orient myself without leaving the leg I am judging.
58. As a sailor, I want to mark a whole leg as not used with the toggle sitting
    next to its point count, so that the consequence of skipping it is visible
    while I decide.
59. As a sailor, I want advancing to the next leg to be what confirms the current
    one, so that review is a single pass rather than a pass plus a confirmation
    chore.
60. As a sailor who leaves review half-finished, I want the legs I already passed
    to stay confirmed and the rest to stay drafts, so that I can come back later
    without redoing work.
61. As a sailor who revisits a leg and changes it, I want the new version to
    replace the old confirmation, so that the last thing I said is what counts.
62. As a sailor, I want SailPlan's proposed spans to fail closed to *not used*
    when the evidence is thin, so that a guess never becomes a polar point.
63. As a sailor, I want SailPlan never to pick a sail because that sail's existing
    polar happens to predict the observed speed, so that the polars cannot
    confirm themselves.
64. As a sailor who stamped on one beat and not the next, I want the sail carried
    across a tack into a genuinely similar leg, so that a third of the race is not
    stranded for want of a re-announcement I would never make.
65. As a sailor, I want that carry-forward to stop at a real change of conditions
    and never chain leg after leg, so that a missed sail change cannot walk the
    wrong sail through the whole race.
66. As a sailor whose peel was stamped early or late, I want the transition
    proposed as *not used* rather than split at an invented midpoint, so that the
    hoist transient feeds neither sail.
67. As a sailor, I want unattributed and not-used samples kept in the recording,
    so that a better attribution later can still use them.

### Promotion

68. As a sailor, I want polar points derived only from stretches where the boat
    was genuinely settled, so that my polars describe the boat rather than the
    manoeuvres.
69. As a sailor, I want a bin to need real evidence — a meaningful number of
    qualifying samples from more than one stretch — before it proposes a point,
    so that one lucky surf does not become a target speed.
70. As a sailor, I want obvious glitches rejected inside a bin before the final
    number is taken, so that a GPS spike is not evidence.
71. As a sailor, I want a leg to be allowed to yield nothing, and the screen to
    read well when a whole race yields a few dozen points, so that the design does
    not push me toward promoting weak data.
72. As a sailor, I want the promotion review to show, per sail and per 10° TWA
    band, what this race said, what my table says, and the delta, so that I can
    argue with a sentence rather than squint at a scatter.
73. As a sailor, I want to see the comparison before anything is written, so that
    promotion is a decision rather than a side effect of finishing review.
74. As a sailor, I want promoted points to land exactly where the interpolator
    will look for them, so that promoting data actually changes what the app
    suggests.
75. As a sailor, I want port and starboard data for the same angle combined, so
    that promotion fits the polar table I already have.
76. As a sailor, I want to hand-select a stretch when the proposals look wrong,
    so that I am not locked out by a filter I disagree with.
77. As a sailor overriding the steadiness test by hand, I want a warning rather
    than a block, so that my judgement wins but I know what I am overriding.
78. As a sailor who promotes the same session twice, I want the second promotion
    to replace the first rather than stack on top of it, so that re-reviewing a
    race cannot double-count it.

### Suggestions built on captured data

79. As a sailor, I want measured points kept separate from imported and
    hand-entered ones rather than pooled, so that one race cannot quietly take
    over the wind range it happened to cover.
80. As a sailor, I want measured data to contribute only where it actually has
    coverage near the conditions I am asking about, so that a light-air race does
    not colour a heavy-air answer.
81. As a sailor, I want the weight given to measured data to be one explicit,
    named number, so that it can be tuned deliberately instead of emerging from
    how long the race happened to be.
82. As a sailor, I want capture sessions to pool with each other, so that my
    polars keep improving as I record more races.

### Sessions, raw logs and storage

83. As a sailor, I want every recording to keep a verbatim raw log, so that a
    parser bug never destroys an unrepeatable race.
84. As a sailor, I want raw logs kept in durable storage that Android cannot
    reclaim, so that they are still there when I need them.
85. As a sailor, I want nothing deleted automatically — no age limit, no cap, no
    oldest-first eviction — so that data never disappears behind my back.
86. As a sailor, I want raw-log size shown per session and in aggregate with a
    **Manage raw logs** action, so that I can decide what to reclaim from
    evidence rather than anxiety.
87. As a sailor, I want the raw-log manager to sort oldest first, support
    multi-select, and preview the space reclaimed, so that a cleanup is one
    informed action.
88. As a sailor, I want deleting only a raw log to leave the session, its
    samples, its stamps and its promoted points intact, so that reclaiming space
    costs me nothing I care about.
89. As a sailor, I want to export a raw log through Android's normal share sheet,
    so that I can hand a race to a tool or a person outside the app.
90. As a sailor, I want deleting a capture session to withdraw its entire polar
    contribution, so that a session I no longer trust leaves nothing behind.
91. As a sailor, I want the delete confirmation to say plainly that promoted
    polar data will go too, so that I cannot destroy it by assuming otherwise.
92. As a sailor whose raw log file cannot be removed, I want plain choices —
    retry, keep the recording, or delete it anyway — so that a filesystem problem
    does not trap me.
93. As a sailor, I want files left behind by an override shown as unlinked raw
    logs with a retry action, so that storage never lies to me.

### Imports, kept honest alongside capture

94. As a sailor, I want re-importing the same polar CSV to be prevented, so that
    a duplicated file cannot silently change what the app suggests.
95. As a sailor, I want a re-export with different formatting recognised as the
    same data, so that whitespace and column casing do not defeat the check.
96. As a sailor importing a file that partly overlaps an earlier import, I want to
    be told how many rows are new and how many are ignored before anything is
    written, so that I choose knowingly.
97. As a sailor, I want each successful import kept as a removable batch, so that
    an import can be taken back out the way a capture session can.
98. As a sailor, I want manual and captured points left out of duplicate matching,
    so that a genuine second measurement is never mistaken for a duplicate.

### Startup and migration

99. As a sailor updating the app, I want the schema migration to apply cleanly
    over my existing polars, so that an update never leaves me with an app that
    will not open.
100. As a sailor, I want my existing hand-entered polar points to keep working
     exactly as before, so that adding capture costs me nothing I already had.

## Implementation Decisions

### 1. Shape of the work

A new **`capture` feature slice** following the house feature-sliced convention
(`api/`, `model/`, `components/`, `hooks/`, `util/`, public barrel). Screens stay
thin and compose it. Three existing areas are extended:

- **`boatProfile`** — a boat-profile detail screen carrying a **Plotter
  connection** section.
- **`sailPolar`** — provenance columns, the source-separating blend wrapper, and
  polar import batches.
- **`sailSuggestion`** — consumes the blended estimate instead of the raw one.

The **capture layer** is app chrome and belongs above the tab navigator, not
inside any screen.

### 2. Transport and the foreground service (`02`, `13`)

- Recording runs inside an Android **foreground service of type
  `connectedDevice`**. Never `dataSync` — Android 15 caps it at 6 h per 24 h.
- Stack proven on hardware in `13`: `react-native-background-actions` plus
  `react-native-tcp-socket`, driven **entirely off the socket's `data` event**.
  **No JS timer may sit on the capture path** — `JavaTimerManager.onHostPause()`
  removes the callback that drives `setTimeout`/`setInterval` while
  backgrounded. `05`'s anchor-triggered emission is what makes this possible and
  removes any need for a native Kotlin tick from v1.
- The socket is always opened with **`interface: 'wifi'`**. This is the mechanism
  for unvalidated boat WiFi and is never a user-facing setting. `13` measured
  that leaving it off fails the no-internet trap non-deterministically.
- **Raw-first, parse-second.** The raw log opens the instant the socket connects.
  `11`'s "wait for valid data before opening the recording" gates the *sample
  pipeline and the session record*, never the file.
- Two hardware findings carried as implementation risks, not design changes: a
  reproducible ANR roughly 5 s after the app returns to `active` (not
  root-caused — budget time for it), and a no-route connection failure costing
  ~31 s to surface, which the connection UX must tolerate without looking hung.
- `app.config.js` sets no explicit `targetSdkVersion`; confirm what Expo SDK 55
  targets at prebuild time.

### 3. The stream contract (`05`, `14`, `17`)

**Validation is v1, at the parse boundary, before any unit conversion.** The
genuine Navico capture used for development is already malformed with no fault
injection, so this is not hardening. Checksum, field count, numeric parse,
per-field range, status flag.

- **Row-level rejection for anchors, field-level for everything else.** A corrupt
  transducer sentence must not cost a wind sample; a row whose *wind* is corrupt
  is not a sample of anything.
- **Status `V` is a rejection, never a zero.**
- **Over-length lines are counted, not rejected** — 5 % of a valid real stream
  breaks the 82-character limit.
- **Parse `MWV` on its flag field, not on the sentence.** Reading apparent and
  true as one stream is a silent, plausible bug that mixes two wind scales into
  one column.
- Per-sentence-type reject counters and per-field stale counters accumulate on
  the session and surface in review as session health.

**Emission is anchor-triggered.** A row is opened by the arrival of `MWV,T`
**or** `VHW`, collects whatever else lands within a **250 ms coalesce window**,
then flushes carrying the most recent value of every field. Minimum **750 ms**
between rows. Two anchors so the recorder survives either wind or boat speed
dying; the coalesce window so two unaligned 1 Hz anchors do not turn a 1 Hz
recording into 2.4 Hz of near-duplicates weighted by sentence timing.

**A capture sample carries measurements only.** Every angle true-north
referenced, every speed in knots, stored as `REAL` with no rounding:

| Field | From | Why |
| --- | --- | --- |
| `timestamp` | derived clock | required |
| `tws`, `twa` | `MWV,T` | the polar's inputs. `twa` **signed ±180°**, positive = starboard, so the tack survives |
| `twd` | `MWD` | cross-check that catches a mis-parsed TWA |
| `stw` | `VHW` | **is** the polar's speed |
| `sog`, `cog` | `VTG`/`RMC` | with STW and heading, gives the current vector — drives the wind-frame classification |
| `hdg` | `HDG` + variation | wind is measured from the bow, so TWD = heading ± TWA. Deriving from COG is wrong by leeway and set, worst exactly when beating |
| `variation` | `RMC`/`HDG` | makes the magnetic→true conversion auditable. `NULL` when unavailable, **never a silent 0** |
| `awa`, `aws` | `MWV,R` | input to the wind-frame cross-check; a column rather than raw-log-only because the raw log may be deleted first |
| `heel`, `trim` | `XDR` | inputs to corrections not applied today; the door cannot be reopened retroactively |
| `lat`, `lon` | `RMC`/`GGA` | without a track, scrubbing to "that beat up the harbour" is guesswork |
| `gpsTime` | `RMC` | nullable; the only way to re-anchor a session whose device clock was wrong |
| `rawOffset` | byte offset | makes the raw log usable, not merely retained |

- **No derived columns.** Our own true wind, TWA folded to 0–180 plus tack, the
  current vector — all pure functions of stored inputs, computed at analysis
  time. A derived column freezes a formula version into the data. Unit and datum
  conversions (km/h→knots, magnetic→true) are the explicit exception.
- **Time is `sessionStartWallClock + monotonicElapsedMs`.** Absolute epoch
  milliseconds, always present, monotonic by construction, immune to the Android
  wall clock stepping mid-race on an NTP sync.
- **Staleness is TTL-null.** A field older than its TTL is written `NULL`, never
  repeated forward. Staleness is *absence of arrival*, not absence of change.
  **TTL = `max(1 s, 3 × nominal period)`** — 3 s for the 1 Hz fields, a 1 s floor
  for 10 Hz heading. A healthy stream never misses more than one consecutive
  second, so both trip only on genuine failure.
- **Gaps are absent rows plus a session-level connection-event log.** No marker
  rows — a marker row is a row that is not a sample and poisons every read of the
  table forever. Then one analysis rule, independent of cause: **any inter-row
  delta beyond ~5 s is a hard discontinuity; never smooth, average or interpolate
  across it.**

**True wind is trusted, not derived.** `MWV,T` is what reaches polar points.
Honest derivation is not configuration-free — it needs a per-boat leeway
coefficient, mast height and an upwash table, and the two dominant corrections
(upwash at 3–5° of TWA, and the instrument's TWA-dependent TWS table) are exactly
the two that cannot be reproduced. Derivation exists only as a **per-session
classification**: derive true wind twice (from STW+heading, and from SOG/COG) and
record which one `MWV,T` tracks → `water` / `ground` / `instrument-corrected` /
`unknown`. Review warns on `ground`. **Derived and instrument values are never
blended** — two wind scales in one table is the worst available outcome.

Sessions whose TWS sits below ~6 kn are flagged low confidence on wind-shear
grounds. This flag is **derived at read time, not stored** — freezing "~6 kn"
into a column is the same formula-versioning trap.

Knots is already canonical throughout the database, so promotion needs no
conversion.

### 4. Connection lifecycle (`11`, `09`)

**Two explicit methods, both living on the boat profile.**

- **Automatic discovery** (default) listens to GoFree UDP multicast
  `239.2.1.1:2052` (JSON, 1 Hz). Setup lists each advertised NMEA source by name
  and model, address as secondary detail. SailPlan stores the selected source's
  name and model plus its last endpoint **as a cache**; a freshly announced
  endpoint is authoritative, because GoFree treats the port as dynamic. The
  announcement carries no durable serial or MAC, so: exactly one match may
  reconnect silently; several matches require the sailor to choose.
- **Manual address** pins host and port. Discovery never silently replaces it.

**Saving is allowed while the plotter is offline.** `Test connection` is offered
and optional; setup shows `Not tested` or the last successful test time.
**Configured means the profile has a connection method, not that the plotter is
reachable** — this is part of the domain model, not copy. `lastTestedAt` sits
beside the setup and is never part of what makes it valid.

**Gating and entry.** With no plotter setup on the active profile, the course
plan's `Record this course` is replaced by **Set up plotter**, deep-linked to the
boat-profile detail screen's Plotter connection section; completing setup returns
to the course plan. With setup, tapping `Record this course` connects, waits for
valid NMEA anchor data, and only then creates the capture session. Failure leaves
the sailor on the plan with **Retry**, **Open Wi-Fi settings** and **Plotter
setup**; no empty session is created.

SailPlan never joins or switches WiFi, stores credentials, or mentions mobile
data. It may open Android's WiFi settings and resumes discovery when the user
returns. Failure copy distinguishes *not on boat WiFi* from *on WiFi, plotter not
found*, and may tell a fresh install to accept Android's **stay connected**
prompt.

**Reconnection is one policy, measured from the last valid NMEA anchor data** —
so a connected-but-silent socket is covered as well as a closed one. Retry
immediately, then at 1 s, 2 s, 5 s and 10 s, then every 15 s. In automatic mode
each attempt listens for a fresh announcement before falling back to the cached
endpoint; manual mode retries only its fixed endpoint. An ambiguous automatic
match never switches source in the background: keep trying the last endpoint,
mark the connection **Needs attention**, and offer selection if the app is
opened.

**Failure is visible and audible.** Loss immediately greys the live values and
shows **Retrying** with the gap age; the notification changes to **Connection
lost — retrying**; vibrate distinctly after 5 s and once more after 60 s and then
no more; one short confirmation vibration on recovery; one final vibration at
auto-end.

**Auto-end, and the v1 softening (spec call).** `11` decided that after five
continuous minutes without valid data the recording auto-ends at its last valid
sample, the service stops, and a `Recording ended — plotter data lost for 5
minutes` notification is posted. The map's final scoping note requires this be
**softened for this build**, because no dock visit has characterised what a real
dropout on this boat looks like and a five-minute hole would otherwise end a race
silently. The softening is **the constant only**: the auto-end horizon is a named
constant defaulting to **30 minutes** in v1, reverting to 5 minutes once ticket
`21` has characterised real dropouts. Everything else in `11`'s model is
unchanged — the retry ladder, the escalation, the end time set to the **last
valid sample** so trailing silence contributes nothing, the `autoEnded` status,
and the resume affordance.

**Resume.** `Resume recording` appears only in the auto-end notification and on
the original course's plan screen. It disappears on dismissal, on another
recording starting, or on that session's data being confirmed/promoted —
whichever comes first — and is never offered later from session history. Resume
reconnects, waits for valid data, then reopens **the same capture session**,
keeps the outage as a connection-event gap, and advances the end time when
capture later stops. A recording stopped deliberately can never resume, and
recovery never starts a new session automatically.

Recovery inside the horizon continues the same session and preserves the outage.
**No manufactured empty sample rows, ever.**

### 5. The capture layer (`09`)

**There is no capture screen.** The course plan must stay usable while recording,
so capture is a layer over the app already in use.

- A slim strip between content and tab bar, on **every** screen while recording:
  connection dot, live **TWS** and **TWA** in large mono digits, the last stamp
  with its age, and a `✚` target. The whole strip is one touch target.
- **Nothing renders when not recording** — no collapsed strip, no placeholder.
- **Bottom scroll inset equal to the strip height on every scrollable screen
  while recording** is a requirement, not a detail.
- Rejected: a floating stamp puck. It reduces "is this working" to a green dot,
  and a frozen-but-connected feed looks identical to a healthy one. The live
  readout is the thing that earns trust.

**Stamping.** Tap the strip → bottom sheet → tap a sail. Two taps, ending in a
**sail stamp**: *this sail was up at this instant*. Nothing is ever turned off.
The sheet is a two-column grid of large colour-coded targets and **scrolls** —
eight is not the ceiling. Mis-taps are corrected by an undo toast (~9 s) and,
failing that, in review. The strip shows the last stamp explicitly labelled as
history, its age turning amber past fifteen minutes.

**The load-bearing rule, inherited by everything downstream: a stamp does not
propagate forward.** Forgetting to stamp must produce *unattributed* samples,
never *wrongly attributed* ones. Silent misattribution poisons a polar; an
unattributed stretch merely wastes it.

**Start and stop.** Start from the course-plan results screen. Stop is a **hold**
on the strip, and the notification's single action.

**The notification is status-only**: live TWS/TWA, sample count, time since the
last stamp, and **Stop**. Sail actions were investigated and are mechanically
legal (a `PendingIntent` targeting a `BroadcastReceiver` that only writes to the
database does not hit Android 12's trampoline restriction), and were **rejected
on design**: Android's template allows at most three actions against a wardrobe
of 8–11 sails, and under the no-propagation rule a wrong stamp is worse than no
stamp.

### 6. Sailed-leg detection (`10`, revised by `22`)

**With a course linked, boundaries are measured against the marks** (`22`). A
course of N marks is a race of N-1 legs by construction, and leg *i* is named for
marks *i* → *i+1* because that is where the boat physically went. Each mark's
distinct approaches — every stretch of track that closes on it and recedes — are
its candidate roundings, and one per mark is chosen so that all are **strictly
increasing in time** at the least total distance (a small dynamic program over
marks × candidates). Greedy "closest approach after the previous mark" is
**wrong and must not be retried**: on Saturday's race the first pass of a mark is
143 m out and the second is 16 m, so a forward scan hands the first mark the
second pass and drags every later mark forward until one collapses.

The guard radius (**750 m**) is a sanity guard against a stale or
mis-georeferenced mark, not the thing that rejects a decoy pass — the monotonic
sequence is. It must stay generous: a **via point**, entered so a course clears a
headland, is passed rather than rounded (143 m on Saturday, easily 500 m on a
course drawn with more margin), and a radius tight enough to reject a 191 m
pre-start decoy would reject genuine via points too. Passes of the same mark are
separated by receding **200 m** and returning, not by leaving the radius, because
a short course may never leave it. Anchoring is on **every course entry, via
points included** — the course model cannot yet tell a via point from a race
mark, and guessing is not attempted; a via-point-split leg is reported as two.

Recording either side of the course is outside every leg: the first leg starts at
the first rounding, so pre-start manoeuvring is not a leg, and there is no
wrap-around leg from the finish back to the start.

**Without a course**, and for a mark the boat never came near, detection is the
original `|TWA|` segmenter, unchanged: over a **±90 s window**, a boundary is a
change in **median `|TWA|` of ≥25°**; minimum leg **180 s**; data gaps are
boundaries. **The sign is ignored** — that is the whole trick: a tack flips TWA's
sign and keeps its magnitude; a rounding changes the magnitude. Sign is *which
tack*; magnitude is *point of sail*; a course leg is a point of sail.

**Why the course-anchored path exists.** `|TWA|` measured 14/14 roundings with 0
spurious — against the **simulator's windward-leeward script**, which is the
geometry it handles best and is **not representative**. On the first real race
(`saturday-race.log`, now the reference fixture) the same code found 9 legs for a
7-leg course, landed 5 of 8 roundings, and — because naming was positional —
misfiled every leg after the first miss. Two roundings sat inside a single
segment of near-constant median `|TWA|`: two legs of run with nothing between
them, and two beats across one 51-minute segment. That is `|TWA|`'s structural
blind spot — consecutive legs at the same point of sail — and no threshold
tuning reaches it.

This **reverses** the earlier rejection of GPS-based segmentation for the
course-linked case, and the reversal is not to be re-litigated. It does not
resurrect what was rejected: net-travel bearing inferred boundaries from track
shape alone and produced 14 spurious boundaries, whereas this matches the track
against **known** mark positions, which is a different problem. Segmenting on
**heading** stays rejected (a tack and a rounding are both ~90°, so it merges
nothing), and so does net-travel bearing for the no-course case.

**Mark names need the linked course.** Inferring them from where the boat rounded
was tried and fails (roundings smeared into 4 clusters where 2 marks exist). With
no course, legs fall back to "Beat 3 / Run 3", renameable.

**Detection is re-runnable.** Review materialises legs once, so a detection fix
would otherwise never reach a session already on the phone. A re-detect action
rebuilds a session's legs and spans, discarding unconfirmed drafts and warning
first when confirmed legs would be lost — a confirmation is a judgement about
*those* boundaries and cannot be carried onto different ones.

**Dropout continuations (spec call, closing `10`'s known gap).** On the `|TWA|`
path, two legs separated only by a data-gap boundary, whose median `|TWA|` values
fall in the same 10° band, are marked as a continuation of one leg and share its
name and ordinal presentation. This is `10`'s explicitly-flagged "cheap to fix at
build time" defect. A course-anchored leg has no continuations: the marks either
side say it is one leg, so a dropout inside it is a gap in that leg.

### 7. Attribution: stamps are evidence, spans are claims (`19`)

A sail stamp means only *this sail was up at this instant*. It never remains in
force and never, by itself, claims its containing leg. From stamps plus
conditions, the app **proposes editable sail-attribution spans**; those proposals
are drafts, never new evidence. **Review edits spans and never creates stamps** —
a review-time correction that manufactured a stamp would launder an inference
into evidence.

**Proposals are leg-local and may cross a tack, but never chain.** A stamp seeds
a draft span in the sailed leg containing it, keeping the default unused head and
tail guards. It may seed **one immediately adjacent unstamped leg** when *all* of:

- the two legs' median `|TWA|` fall in the same **10° review band**;
- their median TWS values are within **2 kn**;
- there is no conflicting stamp; and
- there is no sustained boat-speed regime change.

One hop from evidence, never recursive. TWA sign is ignored, so a tack or gybe
does not stop attribution when the point of sail is unchanged — measured
necessity, since 5 of 17 legs in the reference race had no stamp and every one
was the leg straight after a tack, and carry-forward scored 5/5 against truth.

**Failure is closed.** No stamp, only a distant stamp, no qualifying steady
stretch, or disagreeing similarity tests → propose **not used**. The rule
**never** selects a sail because that sail's existing polar predicts the observed
speed.

**Boat speed finds boundaries; it does not identify sails.** While `|TWA|` and
TWS remain similar, a speed shift greater than **5 %** becomes a candidate
boundary only when the new regime forms a **≥15 s steady stretch** on the same
3 s rolling medians `07` uses. The boundary is the interval between the last
qualifying stretch of the old regime and the first of the new one, and that
interval is proposed **not used** — so hoists, drops and manoeuvre transients
feed neither sail. When two different-sail stamps fall in one leg, each sail
extends toward such a credible boundary; with no credible boundary, the interval
between them stays unattributed and is **never split at an invented midpoint**.

**Three categorical states — draft, confirmed, not used.** No numeric attribution
confidence, deliberately: a second trust knob competing with the evidence rules
is the pathology `03` and `15` already ruled out. **Next** confirms the visible
blocks and moves on; **Finish** confirms the last leg. Leaving review keeps the
current and later legs as drafts and already-advanced legs confirmed; revisiting
and changing a confirmed leg replaces its confirmation. **Only confirmed spans
can produce polar points.** Unconfirmed and not-used samples stay in the session,
available for later manual attribution or reprocessing.

### 8. Review and promotion surfaces (`10`)

**A leg is a row of spans.** Every block carries a sail or nothing:

```
[ not used ][   J1   ][ not used ][   J1   ][ not used ]
  the hoist                a cut                the drop
```

*(From the accepted round-5 prototype. It encodes the decision more precisely
than prose: trimming a head, trimming a tail, cutting a mid-leg section and
changing sail are one act — moving a divider.)*

- **The default spans are load-bearing**: every leg opens *not used / sail / not
  used* at **25 s** and **10 s**. That default is what held mixed-sail legs at
  0/20 (16/20 untrimmed), costing 7 % of the race. **The end trim is not only for
  hoists and drops — it absorbs the leg-detection error**, which is what makes a
  ±33 s boundary survivable and welds the trim default to the detection
  tolerance. They are one decision; retune them together or not at all.
- Any number of cuts; every block resizable, splittable and removable; **merge (a
  deleted divider) is the universal undo**, offered in both directions so the
  first block is removable too. Drag the band to move the nearest divider, or
  nudge a selected block's edges by ±5 s / ±15 s. Minimum block 15 s; splitting a
  block that cannot yield two 15 s halves is refused. A block **carrying a sail**
  that is too short to hold a bin **says so** rather than silently contributing
  nothing — a no-sail block is *meant* to be short, so warning about one only
  teaches sailors to ignore the warning.
- **The band sits under a speed trace** (`stw`, ~90 px, the same time axis,
  no-sail regions shaded). Added after round 5 on the evidence of ticket `15`:
  alone, the band is an abstract bar with no referent — nothing says *when* in
  the leg the boat went slow, which is the only question a divider can answer.
  The trace also forces the band to stay strictly linear in time, so selection
  belongs to a segmented strip beneath it rather than to the band itself, and a
  10 s block still gets a full-size tap. Complementary to the map, which answers
  *where* rather than *when*.
- A leg interrupted by a data gap is stored as several `sailedLeg` rows but
  **reviewed as one leg**, the uncovered time standing as a fixed "no data"
  block: never selected, moved, or merged through. It is therefore a permanent
  divider, and confirming is just splitting the band at it.
- A leg is **used by default**, with the toggle beside its point count where the
  consequence is visible.
- The **map is read-only and follows the pager**. Each span draws in its own
  colour. A chip on the map switches focus-leg ⟷ whole-course, so it is a
  per-glance choice rather than a remembered mode.
- **Promotion review is per sail, per 10° TWA band**: a table carrying the band,
  the TWS range feeding it, what this race says, what the table says, the delta,
  and the point count. A scatter of dots gives nothing to argue with.
- **The screen must read well at 1–4 points per leg.** Under `07`'s settled rule
  the reference two-hour race yields **45 points, median 2 per leg, with 2 legs
  yielding nothing** — roughly five times fewer than the prototype's placeholder
  suggested. The point pill, the review table and the legitimately-empty leg all
  have to look right at that scale.
- Where the stored table has no support, the comparison shows a **confidence
  cue** rather than a bare delta — the same coverage question as §10.
- **Session list**: by date, with duration, sample count and wind range; three
  states — good, **failed** (opens to a dead end explaining why nothing is
  usable) and **empty**.

Multiple sails per leg is the hook the separate **via marks** work plugs into;
`sailedLeg`'s optional course-mark link is the other half of it.

### 9. Promotion pipeline (`07`, `20`)

The filter does the sailing-quality work so the statistic only has to handle
measurement noise.

1. **Steadiness test** — heading within ±5° of the window mean, boat speed within
   ±5 %, TWS within ±1 kn, all held for **≥15 consecutive seconds**, tested on a
   **3 s rolling median** of raw samples. Enough to absorb the 0.1° / 0.1 kn wire
   quantisation without smearing a real transition.
2. **Manoeuvre exclusion is a consequence, not a detector.** A tack breaks the
   ±5° heading band on its own, so a window never reaches 15 s during or straight
   after one. Nothing extra to keep in sync when the bands are retuned.
3. **Binning matches the clustered grid exactly** — 1 kn TWS clusters, 4° TWA
   bins, **points emitted at bin centres**. Captured data is only ever served
   through the clustered path, so promoting at that grid's own resolution puts a
   point where the interpolator will look, and bin centres avoid the
   single-column collapse that raw scatter causes when a race's TWS range has no
   >1 kn gap in it.
4. **Minimum evidence: ≥30 qualifying samples per bin**, roughly two independent
   ≥15 s stretches rather than one long one — checked **before** outlier
   cleanup. Bins that do not reach 30 are simply not proposed.
5. **Outlier rejection**, then the final median:

   ```text
   retain x  ⇔  |x − m| ≤ 4 × max(MAD, 0.1 kn)
   ```

   where `m` is the bin's median. Measured over 400 simulated laps: 4× catches
   99.88 % of injected glitches at n=30 while rejecting 12.06 % of valid
   observations, against 3×'s 17.67 % — best p95 recovery at both 30 and 200
   samples, and not sensitive to bin size. The **0.1 kn floor is the wire
   resolution**; without it a quantised minimum-size bin can have `MAD = 0` and
   reject every non-identical reading (46 of 5,721 trials).
6. **The statistic is the median**, applied once, at promotion. Nothing
   downstream re-applies it — the interpolation-time collision rule is
   deliberately neutral so optimism cannot compound.
7. **Both tacks merge to `|TWA|` at promotion.** `sailPolar` already stores
   unsigned 0–180°; samples keep signed TWA right up to this point. Preserving
   port/starboard asymmetry would need a `tack` column touching interpolation,
   charts and CSV import/export — out of promotion's blast radius, and left in the
   calibration fog.
8. **Manual selection** runs the steadiness test as a **warning, not a block**,
   then shares the identical binning / minimum-evidence / MAD / median path. A
   manual edit changes *which intervals belong to which sail*; it never bypasses
   the steadiness mask.

**Composition with attribution** is through one shared mask: the steadiness test
runs once, sail-independently; attribution uses those stretches only to recognise
sustained speed regimes; review decides which confirmed intervals belong to which
sail; promotion **intersects** confirmed spans with the same mask and then runs
steps 3–6.

A second promotion from the same session **replaces** that session's points
rather than accumulating alongside them.

### 10. Provenance and the read path (`03`, `15`, `16`, `18`)

**Never pool sources.** Interpolate each source on its own grid and blend the two
answers at an explicit weight with an explicit coverage rule. Pooling is already
a blend, just an uncontrolled one — it behaves like a weight of roughly 0.45 set
by point counts and clustering luck, and it collapses whatever contiguous TWS run
has no >1 kn gap into a single column, losing resolution as well as fidelity.
There is a physical reason as well as a measured one: captured wind is
masthead-height and instrument-corrected, imported wind is 10 m free-stream —
5–9 % apart in TWS and 3–5° in TWA.

- **The separation predicate is `sourceKind = 'capture'`**, a plain indexed
  column, not a join. Every future non-capture kind lands on the correct side
  automatically.
- **Capture sessions still pool with each other** — measured strictly good
  (3.33 % → 2.58 % → 2.09 % error as sessions accumulate).
- **The blend is a wrapper above the existing interpolation entry point, which is
  not modified.** It partitions points by `sourceKind`, calls the existing
  estimator once per source, and blends. Existing callers swap one import;
  existing interpolation tests keep their contract.
- **The weight and the coverage radius are named exported constants**, marked in
  code and here as **pending ticket `16`**, which cannot be decided without real
  captured data. Interim values **(spec call)**: measured weight **0.5** inside
  coverage, coverage radius **±1 kn TWS and ±10° TWA** around the query, with the
  weight tapering linearly to zero across the outer half of that radius. 0.5 is
  chosen to sit close to pooling's emergent ~0.45 — v1 gives roughly the answer
  pooling would have given, but explicitly, with the imported grid intact. Do not
  invent additional knobs; `16` moves these two numbers and nothing else.
- Outside coverage, imported and manual points answer alone.

**Prerequisite, already ticketed separately:** the grid-builder invariant from
`15` — a polar grid never holds two rows at one (TWS, TWA) node; exact equality
only, never a tolerance (clustering is the clustered grid's job); median as the
collapse statistic; the contributing count carried from both builders. Duplicate
rows currently collapse interpolation confidence to zero on byte-identical data,
which disables polar-based suggestion entirely. Tracked at
`.tickets/tech-debt/issues/02-duplicate-polar-points-zero-confidence.md` and
**should land before or with this feature**, not inside it.

**Polar import batches (`18`).** Every successful CSV import becomes a
first-class, removable **polar import batch**, and every inserted point links to
it. Duplicate detection has two levels: a **canonical batch fingerprint** over
parsed, validated, sail-matched rows (so row order, whitespace, header casing,
sail-name casing and equivalent numeric formatting are irrelevant), and a
**per-observation fingerprint** — normalised timestamp, mapped sail, TWS, TWA,
boat speed; notes excluded. Including the timestamp is load-bearing: two rows with
identical values at different times are separate observations, and collapsing
them would discard exactly the repeat evidence `15` protects. Rows without a
valid timestamp remain importable but individually uncheckable, and the import
result says how many. **Comparisons are scoped to previous import batches for the
same boat profile** and never touch manual, captured, or pre-migration rows.

Import UX: a clean import proceeds; a partially overlapping one confirms first —
*N new rows will be imported; M previously imported rows will be ignored*, with
Cancel and Import N rows; a wholly duplicate one is blocked with an informational
message and creates no batch. A partial batch owns only the rows it inserted;
shared ownership is deliberately not modelled. A corrected re-export is never
auto-reconciled — remove the earlier batch, then import.

### 11. Raw logs (`06`)

Durable-but-disposable evidence: useful for parser debugging, reprocessing and
export; not precious user content.

1. **Always recorded**, not opt-in, and it does not switch off once the parser is
   trusted.
2. **App document storage**, in a dedicated directory with predictable
   session-based filenames. **Never the Android-reclaimable cache directory.**
3. **Never deleted automatically** — no age limit, storage cap, post-promotion
   deletion, warning threshold or oldest-first eviction in v1.
4. **Manual cleanup is made good**: per-session availability and size, aggregate
   usage, and a **Manage raw logs** action sorting oldest-first with multi-select
   and a preview of space reclaimed. Raw-log-only cleanup preserves the session,
   samples, stamps and promoted points.
5. **Export the whole file** through Android's system save/share surface. No
   in-app sentence viewer, and no UI jumping from a sample to its sentences —
   `rawOffset` is parser/debug provenance.
6. **Missing logs are tolerated.** Raw-log-only cleanup does not rewrite thousands
   of sample rows to null their offsets; offsets remain historical byte
   coordinates, unusable when the log is gone. Availability is handled at
   session/file level.
7. **Deleting a capture session is complete withdrawal** — after destructive
   confirmation, hard-delete its raw log, samples, stamps, legs, spans,
   connection events and every promoted polar point sourced from it. The
   confirmation must say plainly that the contributed polar data goes too. No
   soft-delete, matching the app's existing convention.
8. **The filesystem/SQLite gap is handled explicitly**: remove the file first,
   then the database graph in one transaction. An already-absent file counts as
   success. If file removal fails, offer retry / keep the recording / delete
   anyway, and the override proceeds with the database deletion.
9. **Leftovers are not hidden.** The manager scans the directory as well as
   database-backed sessions; an orphan is shown as an **unlinked raw log** with a
   retry-delete action. If the transaction fails after successful file removal,
   the session simply has no raw log — an already-supported state — and its
   deletion can be retried.

### 12. Schema (`08`)

Two ideas run through it. **Evidence is immutable and claims are mutable** —
samples and stamps are written once and never edited; legs and spans are the
editable claims laid over them by time range. And **provenance is a read-path
predicate, not a relationship**.

Nine new tables, plus four columns on `sailPolar`.

- **`captureSession`** — boat profile, name, nullable course link, `startedAt`,
  nullable `endedAt`, `status`, nullable `resumeDismissedAt`, nullable
  `rawLogPath`, nullable `windFrame`, `healthCounters` (JSON text), `notes`. The
  course link stays **nullable whichever way the course-less-session question
  resolves** — nullable costs nothing today, mandatory would need a migration to
  undo.
- **`captureSample`** — session, timestamp, then §3's fields. **Only the session
  and the timestamp are `notNull`**; TTL-null means any instrument field may
  legitimately be absent. Named `captureSample`, not `nmeaSample`: the row is
  deliberately *not* NMEA (units converted, angles rotated, status-`V` rejected,
  no derived values) and the verbatim wire data is the raw log.
- **`connectionEvent`** — session, `at`, `kind`.
- **`sailStamp`** — session, sail, timestamp. **No end time is expressible**, so
  the misattribution `09` forbids cannot be represented. No `source` column:
  there is only ever one source.
- **`sailedLeg`** — session, `ordinal`, `startTime`, `endTime`, nullable `name`,
  nullable course-mark link, nullable `confirmedAt`.
- **`sailSpan`** — sailed leg, `startTime`, `endTime`, **nullable sail — null is
  "not used"**.
- **`polarImportBatch`** — boat profile, `importedAt`, `fileName`,
  `batchFingerprint`, `rowCount`.
- **`plotterSetup`** — boat profile (unique), `mode`, `sourceName`, `sourceModel`,
  `cachedHost`, `cachedPort`, `host`, `port`, `lastTestedAt`; all mode-specific
  fields nullable. A 1:1 side table rather than six nullable columns on
  `boatProfile` **so that "configured" means a row exists** — one unambiguous
  gate for the start control instead of "which of six columns count?".

**Spans claim time, not rows.** A span carries `[startTime, endTime)` and **no
sample carries a span id**. Dragging a divider in review must not rewrite 400
sample rows, and "not used" then needs no representation at all: a sample in no
span's range is unattributed, which is the safe default. **Legs and spans are
stored, not recomputed on open** — materialised the first time review opens.
Confirmation is per-leg and needs a durable home, and recomputing legs underneath
stored spans would orphan them the moment the detection constants are retuned.

**Lifecycle: three durable states, everything else derived.** `status` ∈
{`active`, `ended`, `autoEnded`} plus nullable `resumeDismissedAt`. **Resumable**
= `autoEnded` ∧ no `resumeDismissedAt` ∧ no later session ∧ nothing confirmed.
**Confirmed/promoted** is the legs' confirmation state, not a fourth status — a
status enum obliged to stay transactionally correct against external facts is a
bug farm.

**`sailPolar` gains** `sourceKind` (`notNull`), nullable `captureSessionId`,
nullable `importBatchId`, and nullable `observationFingerprint`. `sourceKind` ∈
{`manual`, `import`, `capture`}, backfilled to `manual`. A `legacy` value was
proposed and dropped: Logan is the only user, has imported no polars, and knows
the existing rows are hand-entered, so the unknown is not unknown. Residual risk
is mitigated by declaring the column `notNull` **with no ORM-level default** (the
DDL default exists purely to backfill), so a writer that forgets it fails loudly;
import and promotion each go through a single insert path. `observationFingerprint`
is nullable **on `sailPolar`**, not in a side table — `NULL` is meaningful for
undateable and non-import rows alike.

Rejected: a uniform polymorphic `polarSource` table. The separation is a
predicate on every interpolation, which wants an indexed column; import batches
and capture sessions have nothing in common but removability, so the shared
abstraction buys one column and costs a join forever. Also rejected: a
**promotion batch** — withdrawal is already scoped to the whole session, and a
second promotion replaces rather than accumulates. And **`n` is not stored**: `15`
declined to spend it, so a stored count is a column nothing reads, and adding one
to `sailPolar` drags in CSV import/export.

**Indexes.** `captureSample(captureSessionId, timestamp)` **unique** — enforces
the one-row-per-coalesce-window invariant *and* covers review's only access
pattern. Then `sailedLeg(captureSessionId, startTime)`, `sailSpan(sailedLegId)`,
`sailStamp(captureSessionId, timestamp)`, `sailPolar(sailId, sourceKind)` for the
per-source grid build that runs on every suggestion, and
`sailPolar(observationFingerprint)` for partial-overlap checks. Deliberately
**not** indexed: `sailPolar.captureSessionId` / `importBatchId`, read once at
deletion on a table of hundreds of rows. Ordinary rowid-alias primary keys
everywhere, including `captureSample`.

**Integrity follows the house convention: no `onDelete` cascades, no
`PRAGMA foreign_keys`, explicit fan-out in the data-access layer.** Deleting a
capture session removes its spans, legs, stamps, connection events, samples and
promoted points in one transaction. Deleting a sail additionally removes stamps
and spans referencing it. Deleting a boat profile fans out to its sessions.
**Cross-profile integrity is enforced in the writer, not the schema** — nothing
creates a stamp except the sail sheet, which lists only the session profile's
sails.

**Migration is the non-routine part: two, deliberately ordered.** Adding a
foreign key to `sailPolar` makes drizzle-kit drop and recreate the table at
startup behind the migration gate, and a failed migration is an app that will not
open. The trap is that a new column and a new foreign key in the *same* migration
make the generated `INSERT … SELECT` name `sourceKind` on both sides, selecting
it from the old table where it does not exist yet.

1. **Migration A — `sourceKind` alone**, a plain `ALTER TABLE … ADD COLUMN` with
   a DDL default, exactly precedented by an existing migration.
2. **Migration B — everything else**: the nine tables, `observationFingerprint`,
   the two foreign-key columns, the indexes. By then `sourceKind` exists on the
   old table, so the rebuild's copy statement is valid by construction.

Read the generated SQL before trusting it, and test against a **populated**
database, not an empty one. The foreign keys are declared despite the rebuild:
the constraint is unenforced either way, but a lone exception is the sort of
inconsistency someone later tidies up, triggering the same rebuild when
`sailPolar` is full of promoted points instead of a hand-entered handful. The
general rule is already written up in the app's data-layer doc.

## Testing Decisions

### What makes a good test here

Test **external behaviour at the highest seam available**, never implementation
details. The house convention is already this: pure logic lives in a feature's
`util/`, free of React and database access, and is tested as plain input→output
with no Expo or SQLite mocking. There are no component or end-to-end tests, and
this feature does not introduce any — UI is verified by running the app on a
device, and claims about it must say what was actually verified.

The strong asset here is that **`nmea-sim` already exists and produces a
deterministic byte stream with ground truth** — a real Navico replay, a scripted
sail at a known polar, and fault injection as a filter over both. Every
measurement in tickets `05`, `07`, `10`, `19` and `20` was made by driving the
pipeline headlessly against it. The tests should be the same act, kept.

### Seam 1 — one replay entry point for the whole capture pipeline

**A single pure entry point in the capture feature's `util/` layer** takes a raw
NMEA sentence stream plus sail stamps and any review edits, and returns
everything the pipeline derives: capture samples, session health counters, wind
classification, sailed legs, draft sail-attribution spans, and proposed polar
points.

```
replayCaptureSession({ sentences, stamps, courseMarks?, spanEdits? })
  → { samples, health, windFrame, sailedLegs, draftSpans, proposedPoints }
```

This is one seam covering `05`, `07`, `10`, `19` and `20`. Stage functions stay
exported and individually callable — the app needs them separately at runtime —
but **tests prefer the top**, because a test written against real simulator
output and ground truth survives a refactor of the stages, and a test written
against hand-built sample arrays does not.

What it must be exercised with, all of it already existing:

| Input | What it must prove |
| --- | --- |
| the real Navico GoFree capture | validation survives genuinely malformed data — all 142 corrupt `VLW` sentences, `-1.-3` where a number belongs, 331 over-length lines counted not rejected |
| the fault script holding boat speed stale 90 s | **90 rows with `NULL` boat speed and intact wind** — this is `05`'s own stated acceptance condition |
| a status-`V` sentence | rejected, never a 0 kn sample |
| a TCP-split sentence | rejected, not parsed one field out of register |
| the windward-leeward race script | 20 sailed legs, 14/14 roundings, 0 spurious boundaries; ~45 proposed points, median 2 per leg, 2 legs yielding nothing |
| the same, with the deliberately bad stamps (late hoist, early peel, missed hoist) | late hoist excluded by the head guard; early peel produces separate regions with an unused transition; missed hoist leaves the leg **not used** rather than wrongly attributed |
| two unaligned 1 Hz anchors | a true 1 Hz row rate, not 2.4 Hz of near-duplicates |
| a dropout | absent rows, a connection event, no manufactured rows, and no analysis smoothing across the >5 s discontinuity |

Because the entry point is pure, none of this needs a device, a socket or a
database.

### Seam 2 — the existing interpolation and suggestion seam

`03`'s never-pool rule and `16`'s constants are tested at the **seam that already
exists**. The blend is a wrapper above the current interpolation entry point,
which is not modified, so:

- the existing polar-interpolation tests keep their contract unchanged — that is
  itself the regression test that the engine was not touched;
- new tests for the wrapper assert the behaviours, not the arithmetic: imported
  points alone answer outside coverage; captured points contribute inside it;
  the imported grid stays exact at every weight; capture sessions pool with each
  other; the weight is read from the named constant rather than emerging from
  point counts;
- the existing suggestion tests (`suggestSails`, `evaluateSail`, `rankSails`)
  remain the top-level behavioural seam and must still pass;
- the **opt-in accuracy sweep** over the fixture datasets is the right home for
  any "does captured data help or hurt" measurement, and its locked baseline must
  be re-ratcheted deliberately, never silently.

`18`'s fingerprinting is pure and belongs beside the existing CSV sharing logic
in the sail-polar feature's `util/`, tested input→output: canonicalisation
ignores row order, whitespace, header casing, sail-name casing and equivalent
numeric formatting; timestamped rows with identical values but different times
are **not** duplicates; undateable rows are importable and counted as
unchecked.

### What is deliberately not automated

The socket and foreground service, SQLite writes, file writes, and all UI. These
are verified on hardware, as `13` did — and `13` is the precedent for how:
a controlled A/B against a real device, not inference. Specifically to verify on
a device before this is called done: WiFi binding against an unvalidated network,
screen-off reconnect, the notification and vibration escalation, service shutdown
at the auto-end horizon, the two migrations against a populated database, and the
review screen reading well at 1–4 points per leg.

The repository's hotspot rig reproduces the no-internet WiFi trap without the
boat. Automatic-mode discovery tests need the simulator (or a small companion) to
emit the documented 1 Hz GoFree announcement JSON, including multiple/ambiguous
sources and a changed port. Note that a phone whose user once tapped Android's
**stay connected** prompt permanently stops reproducing the trap — a fresh
install is needed to see it.

### Prior art to mirror

The sail-suggestion feature's test suite is the model: pure `util/` functions,
small `makeX` factory helpers with `Partial<T>` overrides rather than repeated
full objects, and an opt-in `*.eval.ts` accuracy sweep held to a locked baseline
alongside the default run. Mirror all three.

## Out of Scope

Ruled out for this spec. Each returns only as a fresh effort.

- **Live telemetry on the Plan tab** — auto-filling TWD/TWS from the feed instead
  of typing them. Prototyped deliberately while resolving `09` to test whether
  the boundary still holds now that the app holds a live feed while the user
  types the wind by hand; the scope line stands, now deliberately rather than by
  default.
- **Live on-water performance feedback** — target speed or percentage-of-polar
  against current conditions. Explicitly the next thing wanted, and it depends on
  this work producing good polars first.
- **Race scoring** — competitors, finish times, results. *Race* does not enter the
  model at all; a session may be a race, a practice or a delivery, and "race" is
  only ever what the sailor types into the name.
- **Instrument calibration.** Detecting or correcting a miscalibrated vane or
  paddlewheel. Sized but not solved: the largest unmodelled term is upwash at
  3–5° of TWA — a full bin — and it is fixed by a calibration the boat's owner
  sails for, on hardware that may not be aboard. Heel and wind gradient are next.
  `heel` and `trim` are stored on every sample precisely so a later decision to
  correct does not require re-recording every session. Measured cost of leaving
  it: a session with a +6 % boat-speed error is not rejected, it is averaged in
  proportionally — one bad session in three drags fleet bias from −0.72 % to
  +1.12 % and flips its sign. That is why being able to take a session back *out*
  is the useful thing about provenance.
- **Port/starboard asymmetry as a calibration signal.** The cheapest available
  signal for the fog above, but surfacing it needs a `tack` column touching
  interpolation, charts and CSV import/export.
- **Generating TWA-limit rows from captured data.** The same tracks reveal the
  angles a sail was actually usable at. Wanted eventually, not sized.
- **Session export or sharing** beyond the raw log. Polars already have CSV
  import/export; whether sessions get the same treatment is open.
- **Fixing the polar CSV import's silent knots assumption** — the only write path
  that does not convert. Real, unrelated, already logged as repo tech debt.
- **Per-leg reversal of a promotion.** Withdrawal granularity is the whole
  session, accepted deliberately: review already prevents a bad race reaching
  promotion, so this only bites on a promotion regretted after confirming.
  Per-leg reversal is a better answer than a session-splice operation, and it is
  designed but not built.
- **A whole-session splice.** Explicitly rejected for the above reason.
- **GPS net-travel-bearing leg detection** as a backstop for consecutive legs at
  the same angle on opposite gybes, *with no course linked*. Recorded, not built.
  With a course linked this case is now solved by anchoring on the marks (§6,
  ticket `22`), which is where it actually bit on the first real race.
- **Real map tiles** under the review track. The map is GPS-only: no chart, no
  land.
- **Sail actions on the notification.** Mechanically legal, rejected on design.
  If ever revisited, whether such an action fires from the lock screen without
  unlocking could not be established from primary sources and must be verified on
  hardware.

## Further Notes

### What is still genuinely open

- **Ticket `16` — the measured-data blend weight and coverage radius.** Blocked
  on real captured data from a race; a fixture where the import is ground truth
  by construction cannot answer it. v1 ships §10's named interim constants, and
  `16` moves those two numbers and nothing else. **Do not treat the interim
  values as validated.**
- **Whether a course-less capture session can be recorded at all.** The only
  start control lives on the course plan behind a selected course, which
  contradicts founding decision 8's deliberate optionality. Left as fog because
  it may resolve itself; `courseId` is nullable either way, so no migration hangs
  on it. If the casual case matters, it needs a second entry point — the session
  list is the obvious second home for a Start control.
- **Which wind frame the Plan tab speaks.** Forecast wind is meteorological
  (ground-referenced); polars should be built from water-referenced instrument
  wind. The TWD a user types and the TWD their polars came from may differ by the
  tidal current vector. Only bites in a tideway, and the size of the bite is
  unknown until a real session is classified.
- **Battery and thermal behaviour** over a three-hour recording.

### Confirmation steps that are not gates

Tickets `04` (the berth half, ~10–15 minutes before slipping) and `21` (race day)
are **confirmation**, not gates. The boat left the critical path once the
simulator existed. Four risks now land on race morning rather than midweek: the
plotter's Serial-output checkbox gating the Ethernet stream (zero bytes at
08:00), an endpoint unknown until the day, `MWV,T` absent or status `V` (a raw log
but no polar points), and a link-local address instead of a DHCP lease. All four
are recoverable *at the berth* with the ticket to hand; none is recoverable once
the lines are off.

**Because the raw log is lossless**, the minimum useful build is connect →
timestamped raw file → survive screen-off. Everything downstream can be built
later and replayed against that file. Build in that order, and a first outing
that goes wrong in every other respect still costs nothing.

### Amendments to the founding decisions, so they are not re-litigated

Three founding decisions were amended by later tickets, and this spec follows the
amendment, not the original:

- **FD4 (sail attribution)** said an assertion holds until the next one. **`09`
  reversed it**: a stamp is a bare point in time that does not propagate forward.
  Forgetting to stamp must yield unattributed samples, never wrongly attributed
  ones — the inverse of the safety property FD4 assumed.
- **FD5 (provenance)** treated the source column as annotation. **`03` made it
  load-bearing for separation**: sources are never pooled.
- **FD8 (session shape)** made the course link optional. **`09` put the only
  start control behind a selected course**, so at the only entry point that
  exists it is mandatory — and added a precondition FD8 did not have: the boat
  profile must carry plotter setup or recording cannot begin.

FD3 (sampling) and FD7 (derivation) were *settled* rather than amended, by `05`
and `07` respectively. FD6 (foreground service) was confirmed on real hardware by
`13` with no code changes implied.

### One recurring failure of reasoning, worth naming

Three separate tickets (`03`, `15`, `19`) independently rejected the same shape
of idea: **a second implicit trust knob**. Sample counts raising confidence,
pooling's emergent weight, a numeric attribution-confidence score — each decodes
to "captured data beats imported data" expressed sideways, duplicating the one
explicit weight `16` owns. If an implementation finds itself wanting another
number that quietly changes how much captured data is believed, that is this
pattern, and the answer is the same: make it the one explicit weight, or do not
add it.
