/**
 * Machine-readable event log — the timing oracle for the device test plan.
 *
 * The human log line (`[10:31:07] client connected: …`) is for watching a run.
 * It has second resolution, no date, and no structure, which makes it useless
 * for the three things `.tickets/nmea-ingestion-build/manual-tests/tickets-05-06-08-test-plan.md`
 * actually gates on:
 *
 * - **the retry ladder** (`0, 1, 2, 5, 10, 15` s). Measured here rather than on
 *   the phone: the simulator sees every reconnect `accept` and can timestamp it
 *   to the millisecond, where an observer with a stopwatch — or an agent with a
 *   round-trip per poll — cannot resolve the 1 s and 2 s rungs at all.
 * - **the fault window boundaries.** T05-2's queries want
 *   `<staleWindowStartEpochMs>` and `<statusVEndEpochMs>` as literals. Those are
 *   script offsets from the moment a client connected, so only the simulator
 *   knows them in wall-clock terms.
 * - **the loss/recovery pairs** the `connectionEvent` rows are checked against.
 *   Two independent records of the same outage is the point: the phone's claim
 *   is only evidence if something outside the phone agrees.
 *
 * One JSON object per line, `t` in epoch milliseconds so it joins directly
 * against `captureSample.timestamp` and `connectionEvent.at`.
 */

const fs = require('fs');
const path = require('path');

/**
 * Returns an `emit(event, fields)` writing JSONL to `filePath`, or a no-op when
 * no path was given. Writes are appended, so a resumed run (T08-4) extends the
 * same file rather than replacing it — matching the raw log's own behaviour,
 * which that case explicitly checks.
 */
function makeEventLog(filePath) {
  if (!filePath) return () => {};

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const stream = fs.createWriteStream(filePath, { flags: 'a' });

  return (event, fields = {}) => {
    const t = Date.now();
    stream.write(
      JSON.stringify({ t, iso: new Date(t).toISOString(), event, ...fields }) + '\n',
    );
  };
}

module.exports = { makeEventLog };
