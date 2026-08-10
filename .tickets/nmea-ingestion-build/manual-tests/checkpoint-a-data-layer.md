# Manual tests — checkpoint A: the data layer

Covers tickets [`01`](../issues/01-migration-a-source-kind.md),
[`02`](../issues/02-migration-b-capture-schema.md),
[`10`](../issues/10-never-pool-blend-wrapper.md),
[`11`](../issues/11-polar-import-batches.md) — the cluster the execution plan
reviews as **CR-A** and gates on hardware as **MT1**.

Three of the four tickets are deliberately invisible to the sailor: `01` and
`02` are migrations, `10` changes nothing while no capture data exists. So most
of what follows is *evidence that nothing broke*, plus a deliberate database
injection (**A4**) to make the blend wrapper observable before ticket `04` can
produce real capture rows.

> **A claim of "passed" must say what was actually observed** — a row count, a
> speed, the exact dialog wording. Record it in the results table at the end.

---

## 0. Preparation

### 0.1 A populated database, not a fresh install

MT1's entire point is the migration running over real data. Before installing
this checkpoint's build, the device must be on the **previous** app build with
its existing polars, sails, marks and courses in place.

If the dev app is already at this checkpoint, roll back first:

```bash
# from the repo root
git stash                       # if you have uncommitted work
git checkout 3ee9d59 -- .       # last commit before migration 0010/0011
cd sailplan-app && npm run android
# … let it open, confirm your polars are there, then:
git checkout nmea-ingestion -- . && npm run android
```

Do **not** uninstall between the two installs — uninstalling drops the database
and the test evaporates.

### 0.2 Back up the device database

```bash
PKG=com.loganmartlew.sailplan.dev
adb shell am force-stop $PKG          # checkpoint the WAL
adb exec-out run-as $PKG cat files/SQLite/sailplan.db     > before.db
adb exec-out run-as $PKG cat files/SQLite/sailplan.db-wal > before.db-wal 2>/dev/null || true
sqlite3 before.db "SELECT COUNT(*), SUM(id), ROUND(SUM(tws+twa+speed),3), SUM(sailId) FROM sailPolar;"
```

Keep that one-line checksum — **A1** compares against it. Also note the counts
of `sail`, `course`, `mark`, `sailTwaLimit`, `boatProfile`.

### 0.3 Database access on the device

Two options, either is fine:

- **Drizzle Studio** — already wired up in
  [`components/MigrationGate.tsx`](../../../sailplan-app/components/MigrationGate.tsx)
  via `expo-drizzle-studio-plugin`. With the dev server running, open the
  *More tools* menu (`shift+m`) in the Expo terminal and pick Drizzle Studio.
- **adb + sqlite3** —
  `adb shell run-as $PKG sqlite3 files/SQLite/sailplan.db "<SQL>"`.
  If the device has no `sqlite3` binary, pull the DB as in 0.2, query it on the
  laptop, and push it back with
  `cat local.db | adb shell "run-as $PKG tee files/SQLite/sailplan.db > /dev/null"`
  (force-stop the app before pulling **and** before pushing).

### 0.4 Test CSVs

```bash
.tickets/nmea-ingestion-build/manual-tests/make-import-test-csvs.sh "A2" ~/polar-tests
adb push ~/polar-tests/. /sdcard/Download/polar-tests/
```

Replace `A2` with the **exact name of a sail on the boat profile under test**
(casing does not matter — that is part of what A5 checks). The generated files
are described in the script's comments; each row's `Notes` column says what it
is for.

### 0.5 Settings

Set the speed unit to **kn** (Settings → speed unit) so the numbers in **A4**
are directly comparable.

---

## A1 — Migrations over a populated database (tickets `01`, `02`)

**This is MT1. If it fails, nothing else in the checkpoint matters.**

1. With the device on the pre-checkpoint build and 0.2 done, install this
   checkpoint's build over the top (`npm run android`).
2. Watch the launch. **Expected:** the *"Migration is in progress…"* gate may
   flash, then the app opens normally. A *"Migration error: …"* screen is a
   hard fail — capture the message and stop.
3. Force-stop and reopen the app twice. **Expected:** opens clean each time
   (migrations are already applied and must not re-run).
4. Pull the migrated DB (`after.db`, same commands as 0.2) and check:

```bash
# a. Not one polar row lost or altered by the sailPolar table rebuild
sqlite3 after.db "SELECT COUNT(*), SUM(id), ROUND(SUM(tws+twa+speed),3), SUM(sailId) FROM sailPolar;"
#    -> must equal the 0.2 checksum exactly

# b. Every pre-existing row backfilled to 'manual', nothing else
sqlite3 after.db "SELECT sourceKind, COUNT(*) FROM sailPolar GROUP BY 1;"
#    -> manual | <the full pre-migration count>   (no other kinds yet)

# c. The provenance columns exist and are empty on legacy rows
sqlite3 after.db "SELECT COUNT(*) FROM sailPolar WHERE captureSessionId IS NOT NULL OR importBatchId IS NOT NULL OR observationFingerprint IS NOT NULL;"
#    -> 0

# d. The eight capture tables exist
sqlite3 after.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1;"
#    -> includes captureSample, captureSession, connectionEvent, plotterSetup,
#       polarImportBatch, sailSpan, sailStamp, sailedLeg

# e. The one-row-per-coalesce-window invariant is a UNIQUE index
sqlite3 after.db "SELECT sql FROM sqlite_master WHERE name='captureSample_captureSessionId_timestamp_idx';"
#    -> CREATE UNIQUE INDEX …

# f. A stamp cannot express an interval; a span's sail can be null
sqlite3 after.db "PRAGMA table_info(sailStamp);"   # -> id, captureSessionId, sailId, timestamp. No end column.
sqlite3 after.db "PRAGMA table_info(sailSpan);"    # -> sailId notnull = 0
sqlite3 after.db "PRAGMA table_info(captureSample);"
#    -> only captureSessionId and timestamp have notnull = 1

# g. plotterSetup is 1:1 per boat profile
sqlite3 after.db "SELECT sql FROM sqlite_master WHERE name='plotterSetup_boatProfileId_unique';"
#    -> CREATE UNIQUE INDEX …

# h. Other tables survived the rebuild
sqlite3 after.db "SELECT (SELECT COUNT(*) FROM sail), (SELECT COUNT(*) FROM course), (SELECT COUNT(*) FROM mark), (SELECT COUNT(*) FROM sailTwaLimit), (SELECT COUNT(*) FROM boatProfile);"
#    -> the counts noted in 0.2
```

5. In the app: open a sail with polars, confirm the polar list and the polar
   chart render as before; open a course leg and confirm sail suggestions still
   appear. **Expected:** indistinguishable from the pre-checkpoint build.

**Pass:** app opens, checksum identical, all eight tables and both unique
indexes present, everything above matches.

---

## A2 — Every write path states its provenance (ticket `01`)

1. Sail detail → **+** → add a polar by hand. Then:
   `SELECT sourceKind, COUNT(*) FROM sailPolar GROUP BY 1;` → the new row is
   **`manual`**.
2. Course leg → the inline "record this as a polar" action on the leg card /
   directions card (whichever you normally use) → add a point.
   **Expected:** also `manual`.
3. Import `base.csv` (A5 step 1 does this). **Expected:** its rows are
   **`import`**, never `manual`.
4. `SELECT COUNT(*) FROM sailPolar WHERE sourceKind IS NULL OR sourceKind NOT IN ('manual','import','capture');`
   → **0**.

**Pass:** three write paths, three correct labels, no unlabelled row anywhere.

---

## A3 — The capture schema holds a session (ticket `02`)

Nothing writes these tables yet, so the check is that they *would* accept a
session and that the invariants bite. Run against the device DB, then roll back.

```sql
-- setup: use a real boatProfile id
INSERT INTO captureSession (boatProfileId, name, startedAt, status, healthCounters, notes)
VALUES (<profileId>, 'schema probe', 1754000000000, 'active', '{}', '');

-- 1. TTL-null: a sample with every instrument field absent is legal
INSERT INTO captureSample (captureSessionId, timestamp) VALUES (last_insert_rowid(), 1754000000000);

-- 2. The coalesce-window invariant: the same timestamp twice must fail
INSERT INTO captureSample (captureSessionId, timestamp)
SELECT captureSessionId, timestamp FROM captureSample LIMIT 1;
--    -> Error: UNIQUE constraint failed  ← this failing is the pass

-- 3. plotterSetup is 1:1 per profile: a second row for the same profile fails
INSERT INTO plotterSetup (boatProfileId, mode) VALUES (<profileId>, 'manual');
INSERT INTO plotterSetup (boatProfileId, mode) VALUES (<profileId>, 'manual');
--    -> second one: Error: UNIQUE constraint failed  ← the pass

-- cleanup
DELETE FROM captureSample WHERE captureSessionId IN (SELECT id FROM captureSession WHERE name='schema probe');
DELETE FROM captureSession WHERE name='schema probe';
DELETE FROM plotterSetup WHERE boatProfileId = <profileId>;
```

4. Reopen the app after the cleanup. **Expected:** opens normally, polars
   unchanged.

**Pass:** the null-only sample inserts; both UNIQUE violations fire; the app is
unaffected.

---

## A4 — The blend wrapper, made observable (ticket `10`)

No capture path exists yet, so capture rows are injected by hand. The
arithmetic below is exact and independent of your polar data — it follows from
`CAPTURE_BLEND_WEIGHT = 0.5` and the ±1 kn / ±10° coverage rectangle in
[`sourceAwareInterpolation.ts`](../../../sailplan-app/features/sailPolar/util/sourceAwareInterpolation.ts).

### A4.0 Establish the baseline condition

1. Open a course leg that produces a sail suggestion, tap **Details** on the
   breakdown.
2. Read the header: `TWA <a> · TWS <s>` — **these exact numbers are the target**.
   Do not try to hit round numbers; take whatever the leg gives you.
3. Note, for one sail with polar coverage there, its **predicted speed `P0`**
   and **confidence** shown on the card. Note its `sailId`
   (`SELECT id, name FROM sail;`).

### A4.1 Inside coverage — the capture answer contributes exactly half

Inject a 2×2 capture block centred on the target, all four points carrying the
same speed `S`. Pick `S` about 2 kn away from `P0` so the shift is unmistakable
(e.g. `P0 = 6.8` → `S = 9.0`).

```sql
INSERT INTO sailPolar (sailId, tws, twa, speed, sourceKind) VALUES
  (<sailId>, <s>-0.5, <a>-5, <S>, 'capture'),
  (<sailId>, <s>-0.5, <a>+5, <S>, 'capture'),
  (<sailId>, <s>+0.5, <a>-5, <S>, 'capture'),
  (<sailId>, <s>+0.5, <a>+5, <S>, 'capture');
```

Reopen the leg (the live query should refresh; force-stop and reopen if not).

**Expected:** predicted speed ≈ **`(P0 + S) / 2`**, within rounding —
for `P0 = 6.80`, `S = 9.00` that is **7.90**. Not `S`, not `P0`, and not
somewhere else: half is the named constant showing itself.

### A4.2 Capture sessions pool with each other

Change two of the four rows to `S - 1` and two to `S + 1`, i.e. two "sessions"
disagreeing symmetrically:

```sql
UPDATE sailPolar SET speed = <S>-1 WHERE sourceKind='capture' AND twa = <a>-5;
UPDATE sailPolar SET speed = <S>+1 WHERE sourceKind='capture' AND twa = <a>+5;
```

**Expected:** the prediction stays close to A4.1's value (both sessions feed one
capture estimate). If only one of the two speeds shows through, capture sources
are not pooling.

### A4.3 Outside coverage — imported data answers alone

```sql
UPDATE sailPolar SET tws = tws + 4, twa = twa + 40 WHERE sourceKind = 'capture';
```

**Expected:** predicted speed returns to **exactly `P0`**, and the confidence
returns to its baseline value. Captured data more than ±1 kn / ±10° away must
contribute nothing at all.

### A4.4 The taper is linear across the outer half

Move the block to +7° TWA (nearest relative distance 0.7 → weight
`0.5 × 2 × (1 − 0.7) = 0.3`):

```sql
DELETE FROM sailPolar WHERE sourceKind = 'capture';
INSERT INTO sailPolar (sailId, tws, twa, speed, sourceKind) VALUES
  (<sailId>, <s>-0.5, <a>+7,  <S>, 'capture'),
  (<sailId>, <s>-0.5, <a>+15, <S>, 'capture'),
  (<sailId>, <s>+0.5, <a>+7,  <S>, 'capture'),
  (<sailId>, <s>+0.5, <a>+15, <S>, 'capture');
```

**Expected:** predicted speed ≈ **`P0 + 0.3 × (S − P0)`** — for `P0 = 6.80`,
`S = 9.00` that is **7.46**. A partial, graded contribution: not full weight,
not zero.

### A4.5 Clean up — mandatory

```sql
DELETE FROM sailPolar WHERE sourceKind = 'capture';
```

Confirm in the app that the leg's prediction is back to `P0` and
`SELECT COUNT(*) FROM sailPolar WHERE sourceKind='capture';` → **0**. Leaving
injected rows behind will poison every later checkpoint.

**Pass:** A4.1 ≈ halfway, A4.2 stable, A4.3 exactly `P0`, A4.4 ≈ 30 % of the
way, and the database is clean afterwards.

---

## A5 — Import batches and duplicate prevention (ticket `11`)

Entry points: **Sails list → the share/upload button beside "New Sail"**
(all sails; unrecognised names are reported) and **Sail detail → the upload
icon** (that sail only; unrecognised names are silently skipped).

Run 1–7 in order — each depends on the previous state.

| # | Do this | Expected |
| --- | --- | --- |
| 1 | Sails list → import `base.csv` | *"Import Complete — 6 polar rows added."* **6, not 5**: rows 1 and 6 hold identical values at different times and are two observations, not a duplicate |
| 2 | Scroll to the bottom of the Sails list | An **Import Batches** section: `base.csv · 6 polars · <today>` |
| 3 | Import `base.csv` again | *"Already Imported"* — "These polar observations have already been imported. Remove the earlier import batch before importing a corrected export." **No second batch appears; the polar count is unchanged** |
| 4 | Import `reformatted.csv` | Same *"Already Imported"* block. This is the load-bearing one: different header casing, row order, whitespace, trailing zeroes and sail-name casing, same observations |
| 5 | Import `partial.csv` | Confirm dialog *"Some Polars Already Imported — 3 new rows will be imported; 3 previously imported rows will be ignored."* with **Cancel** and **Import 3 Rows**. Tap **Cancel** → nothing written, no new batch |
| 6 | Import `partial.csv` again, tap **Import 3 Rows** | *"3 polar rows added."* A second batch appears showing **3 polars** — the batch owns only what it inserted |
| 7 | Import `undated.csv` | *"3 polar rows added."* plus *"2 rows have no valid timestamp and could not be checked for overlap."* Undateable rows import but stay individually uncheckable |
| 8 | Import `unmatched.csv` (from the **Sails list**) | *"2 polar rows added."* plus *"Unrecognised sail names: Ghost Kite"* |
| 9 | Import `nothing-valid.csv` | *"No Polars Imported — The file has no valid rows for the selected sail or sails."* No batch created |
| 10 | Edit `nothing-valid.csv` to add one valid row for your test sail with a fresh timestamp, then import it from the **sail detail** screen | *"1 polar row added."* with **no** "Unrecognised sail names" line — the per-sail path deliberately does not report names it was never asked about |

### A5.11 Removal takes exactly its own rows

1. Note `SELECT COUNT(*) FROM sailPolar WHERE sailId = <sailId>;` and the
   manual-row count.
2. Import Batches → trash icon on the `base.csv` batch → confirm
   *"Remove 6 imported polars from base.csv? Manual and captured polars will be
   kept."* → **Remove Import**.
3. **Expected:** the batch row disappears; exactly 6 rows gone; every `manual`
   row still present; the other batches untouched.
4. `SELECT COUNT(*) FROM sailPolar WHERE importBatchId NOT IN (SELECT id FROM polarImportBatch);` → **0** (no orphaned rows).

### A5.12 A corrected re-export is not auto-reconciled

After removing the `base.csv` batch, import `base.csv` again.
**Expected:** it imports cleanly (6 rows, new batch). Removal-then-import is
the supported correction path, and it works.

### A5.13 Scoping is per boat profile

1. Switch to a second boat profile (create a throwaway one with a sail of the
   same name if needed).
2. **Expected:** the Import Batches section shows **only that profile's**
   batches — the first profile's are not listed.
3. Import `base.csv` here. **Expected:** it imports rather than being blocked —
   comparisons never cross profiles.
4. Delete the throwaway profile afterwards if you made one.

**Pass:** every row of the table matches, removal is surgical, and neither
scoping check leaks across profiles.

---

## A6 — Edge probes (expect a judgement call, not necessarily a pass)

These are the seams where the four tickets touch each other. Record what
happens; some may be decisions to make rather than defects.

1. **Delete-all vs. batches.** On a sail with imported polars, use the sail
   detail *Delete All Polars* button, then look at Import Batches.
   *Watch for:* the batch row surviving with a `rowCount` that no longer
   describes any rows — and then `base.csv` being refused as
   "Already Imported" while none of its rows exist. If that happens, it is a
   real trap for you on the water; note it for a follow-up ticket rather than
   ticking A5.
2. **Sail deletion guard.** A sail with only imported polars cannot be deleted
   ("This sail has associated polars"). Remove its import batch, then delete
   the sail. **Expected:** now allowed.
3. **Units in the CSV.** A row like `12kn` in the TWS column is read as `12`
   (deliberate — see the comment in `csvImport.ts`). Confirm such a row imports
   and is then recognised as a duplicate on re-import.
4. **App restart mid-flow.** Import `partial.csv`, get the confirm dialog, kill
   the app from the dialog. **Expected:** on reopen, nothing was written and no
   partial batch exists.

---

## Results

| Test | Covers | Result | What was actually observed |
| --- | --- | --- | --- |
| A1 migrations over populated DB | `01`, `02` | | checksum before / after: |
| A2 provenance on every write path | `01` | | |
| A3 capture schema invariants | `02` | | |
| A4.1 half-weight inside coverage | `10` | | `P0` = , `S` = , observed = |
| A4.2 sessions pool | `10` | | |
| A4.3 nothing outside coverage | `10` | | |
| A4.4 linear taper | `10` | | |
| A4.5 injected rows removed | `10` | | |
| A5.1–10 import outcomes | `11` | | |
| A5.11 batch removal | `11` | | |
| A5.12 remove-then-reimport | `11` | | |
| A5.13 per-profile scoping | `11` | | |
| A6 edge probes | all | | |

Once A1 is signed off, tick MT1 in the
[execution plan](../execution-plan.md#manual-test-checkpoints) and run
`/code-review` for **CR-A** across `01`, `02`, `10`, `11`.
