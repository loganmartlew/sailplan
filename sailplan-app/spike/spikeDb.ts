// THROWAWAY — ticket `13` device spike only.
//
// A separate database file from `sailplan.db` on purpose: the spike must never
// be able to corrupt real data, and it must be deletable by uninstalling
// nothing. No drizzle, no migrations — raw SQL, because the schema here is
// instrumentation, not domain.

import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

let cached: SQLiteDatabase | null = null;

export function spikeDb(): SQLiteDatabase {
  if (cached) return cached;

  const db = openDatabaseSync('spike.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS spike_run (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at    INTEGER NOT NULL,
      ended_at      INTEGER,
      host          TEXT    NOT NULL,
      port          INTEGER NOT NULL,
      wifi_interface INTEGER NOT NULL,
      -- 250 in a real-time run, 0 when replaying fast-forwarded. Recorded
      -- because it changes what the row count means: the window is wall-clock,
      -- so at 60x it would throttle a 3-hour log down to 3 minutes of rows.
      coalesce_ms   INTEGER NOT NULL DEFAULT 250,
      note          TEXT
    );

    -- One row per emitted sample, on '05's anchor rule. 'gap_ms' is the whole
    -- point: a hole in the recording is a run of rows whose gap exceeds the
    -- expected ~1000 ms, and it is measurable after the fact without trusting
    -- anything the app said while it was running.
    CREATE TABLE IF NOT EXISTS spike_sample (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id     INTEGER NOT NULL,
      seq        INTEGER NOT NULL,
      ts         INTEGER NOT NULL,
      gap_ms     INTEGER NOT NULL,
      anchor     TEXT    NOT NULL,
      sentences  INTEGER NOT NULL,
      tws        REAL,
      twa        REAL,
      stw        REAL,
      hdg        REAL
    );

    CREATE INDEX IF NOT EXISTS spike_sample_run ON spike_sample (run_id, seq);

    -- Lifecycle: everything that is not a sample. Socket state, app state,
    -- JS-timer stalls, flush stats, errors.
    CREATE TABLE IF NOT EXISTS spike_event (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      ts     INTEGER NOT NULL,
      kind   TEXT    NOT NULL,
      detail TEXT
    );

    CREATE INDEX IF NOT EXISTS spike_event_run ON spike_event (run_id, ts);
  `);

  cached = db;
  return db;
}

export function startRun(
  host: string,
  port: number,
  wifiInterface: boolean,
  coalesceMs: number,
  note: string | null
): number {
  const db = spikeDb();
  const result = db.runSync(
    `INSERT INTO spike_run
       (started_at, host, port, wifi_interface, coalesce_ms, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Date.now(), host, port, wifiInterface ? 1 : 0, coalesceMs, note]
  );
  return result.lastInsertRowId;
}

export function endRun(runId: number) {
  spikeDb().runSync(`UPDATE spike_run SET ended_at = ? WHERE id = ?`, [
    Date.now(),
    runId,
  ]);
}

export type PendingSample = {
  seq: number;
  ts: number;
  gapMs: number;
  anchor: string;
  sentences: number;
  tws: number | null;
  twa: number | null;
  stw: number | null;
  hdg: number | null;
};

/**
 * One transaction for the whole batch. `research/02` risk 8: a long SQLite
 * write session on the JS thread is the thing most likely to stutter the
 * capture, and batching in a transaction is the stated mitigation.
 */
export function insertSamples(runId: number, rows: PendingSample[]) {
  if (rows.length === 0) return;
  const db = spikeDb();
  const stmt = db.prepareSync(
    `INSERT INTO spike_sample
       (run_id, seq, ts, gap_ms, anchor, sentences, tws, twa, stw, hdg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    db.withTransactionSync(() => {
      for (const r of rows) {
        stmt.executeSync([
          runId,
          r.seq,
          r.ts,
          r.gapMs,
          r.anchor,
          r.sentences,
          r.tws,
          r.twa,
          r.stw,
          r.hdg,
        ]);
      }
    });
  } finally {
    stmt.finalizeSync();
  }
}

export function logEvent(runId: number, kind: string, detail?: unknown) {
  spikeDb().runSync(
    `INSERT INTO spike_event (run_id, ts, kind, detail) VALUES (?, ?, ?, ?)`,
    [
      runId,
      Date.now(),
      kind,
      detail === undefined ? null : JSON.stringify(detail),
    ]
  );
}
