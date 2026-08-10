#!/usr/bin/env node
// THROWAWAY — ticket `13` device spike only.
//
// Pulls the spike database off the phone and scores it. The point of the whole
// rig is item 3: "count them; don't eyeball it". The numbers that matter are
// coverage (rows actually written vs rows a 1 Hz stream should have produced)
// and holes (runs of missing seconds), because a foreground service that dies
// and silently restarts looks fine on screen and shows up here as a gap.
//
// Also carries the session-4 diagnostic: `data_event` rows (one per socket
// `data` chunk, logged before line-splitting) let this tell apart "the socket
// itself went quiet" from "the anchor/coalesce logic downstream ate samples"
// — the open question behind the thinning-under-backgrounding finding, which
// is invisible to the hole detector above because no individual gap exceeds
// its 3s threshold.
//
//   node spike/report.mjs                      # pull from the device, then report
//   node spike/report.mjs /tmp/spike.db        # report a file already pulled
//   node spike/report.mjs --run 3              # one run instead of all
//
// Uses node:sqlite (Node 22+), so there is nothing to install.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PKG = process.env.SPIKE_PKG ?? 'com.loganmartlew.sailplan.dev';
const REMOTE_DIR = 'files/SQLite';

// Below the 3s sample-hole threshold on purpose — the thinning finding is
// exactly the case where no single sample gap is big enough to trip that
// detector, so this has to look one level lower, at the socket `data` events
// the samples are derived from.
const DATA_GAP_MS = 1500;

const args = process.argv.slice(2);
const runFilter = (() => {
  const i = args.indexOf('--run');
  return i >= 0 ? Number(args[i + 1]) : null;
})();
const localArg = args.find((a) => !a.startsWith('--') && a !== String(runFilter));

const dbPath = localArg ?? pullDatabase();
const db = new DatabaseSync(dbPath, { readOnly: true });

const runs = db
  .prepare(`SELECT * FROM spike_run ORDER BY id`)
  .all()
  .filter((r) => runFilter === null || r.id === runFilter);

if (runs.length === 0) {
  console.log('no runs in', dbPath);
  process.exit(0);
}

for (const run of runs) report(run);

// ---------------------------------------------------------------------------

/**
 * `run-as` works because development builds are debuggable. WAL means the
 * newest rows may live in -wal rather than the main file, so all three parts
 * come across and sqlite recovers them on open.
 */
function pullDatabase() {
  const dir = mkdtempSync(join(tmpdir(), 'spike-'));
  for (const suffix of ['', '-wal', '-shm']) {
    const remote = `${REMOTE_DIR}/spike.db${suffix}`;
    try {
      const bytes = execFileSync(
        'adb',
        ['exec-out', 'run-as', PKG, 'cat', remote],
        { maxBuffer: 512 * 1024 * 1024 }
      );
      if (bytes.length > 0) writeFileSync(join(dir, `spike.db${suffix}`), bytes);
    } catch (e) {
      if (suffix === '') {
        console.error(`could not read ${remote} from ${PKG}:`);
        console.error(String(e.stderr ?? e.message).trim());
        console.error(
          '\nIf run-as is refused, the build is not debuggable — use the ' +
            'Share db button on the spike screen instead and pass the file path.'
        );
        process.exit(1);
      }
    }
  }
  console.log(`pulled ${PKG}:${REMOTE_DIR}/spike.db → ${dir}\n`);
  return join(dir, 'spike.db');
}

function report(run) {
  const samples = db
    .prepare(
      `SELECT ts, gap_ms, sentences FROM spike_sample WHERE run_id = ? ORDER BY seq`
    )
    .all(run.id);

  const events = db
    .prepare(`SELECT ts, kind, detail FROM spike_event WHERE run_id = ? ORDER BY ts`)
    .all(run.id);

  const started = run.started_at;
  const ended = run.ended_at ?? samples.at(-1)?.ts ?? started;
  const wallSec = Math.max(1, Math.round((ended - started) / 1000));

  // The stream is 1 Hz (`01` measured it, `05` anchors on it), so in a
  // real-time run one row per second is the ceiling and coverage below 100% is
  // either a hole or a stream that was slower than advertised — the hole list
  // separates the two. With the coalesce window at 0 the run was a
  // fast-forwarded replay, where rows-per-second is a throughput number and
  // means nothing about coverage.
  const realTime = (run.coalesce_ms ?? 250) > 0;
  const rate = (samples.length / wallSec).toFixed(1);

  const holes = samples
    .map((s, i) => ({ ...s, i }))
    .filter((s) => s.i > 0 && s.gap_ms > 3000);

  const lostSec = Math.round(
    holes.reduce((acc, h) => acc + h.gap_ms - 1000, 0) / 1000
  );

  const stalls = events.filter((e) => e.kind === 'timer_stall');
  const ticks = events.filter((e) => e.kind === 'timer_heartbeat');
  const stop = events.find((e) => e.kind === 'run_stop');
  const summary = stop ? JSON.parse(stop.detail) : null;

  // Both boundaries computed off `app_state`, so this works for a run with any
  // number of background/foreground transitions, not just one round trip.
  const bgStart = events.find(
    (e) => e.kind === 'app_state' && JSON.parse(e.detail).next === 'background'
  )?.ts;
  const bgEnd = events.find(
    (e) => e.kind === 'app_state' && JSON.parse(e.detail).next === 'active'
  )?.ts;
  const inBg = (ts) =>
    bgStart !== undefined && ts >= bgStart && (bgEnd === undefined || ts <= bgEnd);

  const dataEvents = events
    .filter((e) => e.kind === 'data_event')
    .map((e) => ({ ts: e.ts, ...JSON.parse(e.detail) }));
  const dataGaps = dataEvents.filter((e) => e.gapMs > DATA_GAP_MS);

  // `bytes` and the raw-sentence count behind each sample (below) are both
  // captured independently of JS-processing clock time, so — unlike
  // `data_event` gaps — they survive the case where the bridge queues several
  // native callbacks and flushes them to JS back-to-back: every `Date.now()`
  // in that flush reads almost the same instant no matter when the data
  // really arrived, but an unusually large chunk size does not depend on when
  // it was read, only on how much had piled up before it was.
  const bgChunks = dataEvents.filter((e) => inBg(e.ts));
  const fgChunks = dataEvents.filter((e) => !inBg(e.ts));
  const avgBytes = (xs) => (xs.length ? xs.reduce((a, e) => a + e.bytes, 0) / xs.length : 0);
  const maxBytes = (xs) => (xs.length ? Math.max(...xs.map((e) => e.bytes)) : 0);
  const biggestChunks = [...dataEvents].sort((a, b) => b.bytes - a.bytes).slice(0, 5);

  // Line-count delta between consecutive samples, independent of clock time
  // altogether: it is a straight count of raw NMEA sentences the parser saw
  // between one surviving anchor and the next. A delta far above the run's
  // typical value means lines piled up ahead of the anchor that made it
  // through `05`'s coalesce filter — evidence of batching upstream that no
  // amount of `Date.now()` timestamping downstream of it can see.
  const deltas = samples.map((s, i) => ({
    ts: s.ts,
    delta: i === 0 ? s.sentences : s.sentences - samples[i - 1].sentences,
  }));
  const sortedDeltas = [...deltas.map((d) => d.delta)].sort((a, b) => a - b);
  const medianDelta = sortedDeltas[Math.floor(sortedDeltas.length / 2)] ?? 0;
  const deltaSpikes = deltas.filter((d) => medianDelta > 0 && d.delta > medianDelta * 3);

  // Where in the run activity actually happened, independent of any average:
  // an even ~3s cadence throughout looks identical to a long silent stretch
  // followed by a denser catch-up window when you only look at consecutive-
  // pair statistics (gaps, chunk sizes, sentence deltas) — this is the one
  // view that tells them apart.
  const BUCKET_MS = 30_000;
  const nBuckets = Math.max(1, Math.ceil((ended - started) / BUCKET_MS));
  const dataBuckets = new Array(nBuckets).fill(0);
  const sampleBuckets = new Array(nBuckets).fill(0);
  for (const e of dataEvents) {
    const i = Math.min(nBuckets - 1, Math.floor((e.ts - started) / BUCKET_MS));
    dataBuckets[i]++;
  }
  for (const s of samples) {
    const i = Math.min(nBuckets - 1, Math.floor((s.ts - started) / BUCKET_MS));
    sampleBuckets[i]++;
  }

  // A stall and a data gap "move together" if they land within a second of
  // each other — evidence for one shared cause (bridge/Choreographer-gated
  // delivery) rather than two independent ones.
  const correlated = dataGaps.filter((g) =>
    stalls.some((s) => Math.abs(s.ts - g.ts) < 1000)
  );

  // Item 5 of the "Next" diagnostic list: does the backlog on resume scale
  // with how long the app was backgrounded? The first data_event after each
  // `app_state → active` transition is where a buffered burst would surface.
  const resumes = events.filter(
    (e) => e.kind === 'app_state' && JSON.parse(e.detail).next === 'active'
  );
  const resumeBursts = resumes.map((r) => {
    const next = dataEvents.find((d) => d.ts >= r.ts);
    return { resumeAt: r.ts, burst: next ?? null };
  });

  console.log(`── run ${run.id} ${run.ended_at ? '' : '(never stopped)'}`);
  console.log(`   ${new Date(started).toISOString()} → ${wallSec}s wall clock`);
  console.log(
    `   ${run.host}:${run.port}  interface:'wifi' ${run.wifi_interface ? 'ON' : 'OFF'}${
      run.note ? `  — ${run.note}` : ''
    }`
  );
  console.log(
    `   rows        ${samples.length} ` +
      (realTime
        ? `(${((samples.length / wallSec) * 100).toFixed(1)}% of 1 Hz)`
        : `(${rate}/s throughput — fast-forwarded, coverage not meaningful)`)
  );
  if (realTime) {
    console.log(
      `   holes >3s   ${holes.length}${holes.length ? `  losing ~${lostSec}s` : ''}`
    );
  }
  if (summary) {
    console.log(
      `   sentences   ${summary.lines} (${summary.badChecksum} bad checksum)`
    );
  }
  console.log(
    `   JS timer    ${ticks.length * 60 + stalls.length} ticks, ${stalls.length} stalls` +
      (stalls.length
        ? `, worst ${Math.max(...stalls.map((s) => JSON.parse(s.detail).deltaMs))} ms`
        : '')
  );

  for (const h of holes.slice(0, 20)) {
    console.log(
      `     hole  ${new Date(h.ts - h.gap_ms).toISOString().slice(11, 19)}` +
        ` +${(h.gap_ms / 1000).toFixed(1)}s`
    );
  }
  if (holes.length > 20) console.log(`     … ${holes.length - 20} more`);

  if (dataEvents.length > 0) {
    console.log(
      `   data gaps   ${dataGaps.length} over ${DATA_GAP_MS}ms` +
        (dataGaps.length
          ? `, worst ${Math.max(...dataGaps.map((g) => g.gapMs))} ms, ` +
            `${correlated.length}/${dataGaps.length} within 1s of a timer stall`
          : '')
    );
    for (const g of dataGaps.slice(0, 20)) {
      const hit = stalls.some((s) => Math.abs(s.ts - g.ts) < 1000);
      console.log(
        `     gap   ${new Date(g.ts - g.gapMs).toISOString().slice(11, 19)}` +
          ` +${(g.gapMs / 1000).toFixed(1)}s → ${g.bytes}B burst` +
          (hit ? '  (± timer stall)' : '')
      );
    }
    if (dataGaps.length > 20) console.log(`     … ${dataGaps.length - 20} more`);

    console.log(
      `   chunk size  fg avg ${avgBytes(fgChunks).toFixed(0)}B / max ${maxBytes(fgChunks)}B` +
        (bgChunks.length
          ? `  ·  bg avg ${avgBytes(bgChunks).toFixed(0)}B / max ${maxBytes(bgChunks)}B (${bgChunks.length} chunks)`
          : '  ·  no chunks logged while backgrounded')
    );
    for (const e of biggestChunks) {
      console.log(
        `     chunk ${new Date(e.ts).toISOString().slice(11, 19)}  ${e.bytes}B` +
          `${inBg(e.ts) ? '  (background)' : ''}`
      );
    }
  }

  if (deltas.length > 1) {
    console.log(
      `   sentences/sample  median ${medianDelta}` +
        (deltaSpikes.length
          ? `, ${deltaSpikes.length} spikes over 3× median (worst ${Math.max(...deltaSpikes.map((d) => d.delta))})`
          : ', no spikes over 3× median')
    );
    for (const s of deltaSpikes.slice(0, 5)) {
      console.log(
        `     spike ${new Date(s.ts).toISOString().slice(11, 19)}  ${s.delta} lines since previous sample` +
          `${inBg(s.ts) ? '  (background)' : ''}`
      );
    }
  }

  if (nBuckets > 1) {
    console.log(
      `   activity per 30s bucket (digit = samples, capped at 9 · · = data arrived but no sample survived · space = nothing logged)`
    );
    const ROW = 20; // 10 minutes per printed row
    for (let row = 0; row < nBuckets; row += ROW) {
      let line = '';
      for (let i = row; i < Math.min(nBuckets, row + ROW); i++) {
        line += sampleBuckets[i] > 0 ? String(Math.min(9, sampleBuckets[i])) : dataBuckets[i] > 0 ? '·' : ' ';
      }
      console.log(`     +${row * 30}s  ${line}`);
    }
  }

  if (resumeBursts.length > 0) {
    console.log('   resume bursts (item 5 of the diagnostic list)');
    for (const { resumeAt, burst } of resumeBursts) {
      const t = new Date(resumeAt).toISOString().slice(11, 19);
      console.log(
        burst
          ? `     ${t}  next data_event +${(burst.gapMs / 1000).toFixed(1)}s, ${burst.bytes}B`
          : `     ${t}  no data_event after resume`
      );
    }
  }

  const notable = events.filter(
    (e) => !['timer_heartbeat', 'timer_stall', 'data_event'].includes(e.kind)
  );
  console.log('   timeline');
  for (const e of notable) {
    const t = new Date(e.ts).toISOString().slice(11, 19);
    console.log(`     ${t}  ${e.kind}${e.detail ? `  ${e.detail}` : ''}`);
  }
  console.log();
}
