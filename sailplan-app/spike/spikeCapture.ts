// THROWAWAY — ticket `13` device spike only.
//
// The smallest thing that can answer "does a TCP capture survive the phone
// being backgrounded, screen off, for a race". Not the feature: no domain
// model, no drizzle, no UI state management beyond a snapshot the screen polls
// when it happens to be visible.
//
// Two rules this obeys deliberately, both from `research/02`:
//
//   1. **Nothing on the capture path uses a JS timer.** Timers ride on
//      Choreographer via the UI thread and are un-armed by `onHostPause`;
//      whether they fire at all with the display off is the open question
//      item 4 exists to observe. So emission, batching and flushing are all
//      driven by socket `data` arrival. The one `setInterval` in this file is
//      a *probe* whose stalls are recorded as evidence — nothing depends on it.
//   2. **The socket is opened inside the background task**, after the
//      foreground service is up, so the process is already non-cached before
//      there is a socket to lose.

import { AppState, type AppStateStatus } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import TcpSocket from 'react-native-tcp-socket';
import {
  endRun,
  insertSamples,
  logEvent,
  startRun,
  type PendingSample,
} from './spikeDb';

export type SpikeConfig = {
  host: string;
  port: number;
  /** Item 5: pin the socket to WiFi, or deliberately don't, to reproduce the trap. */
  wifiInterface: boolean;
  /**
   * `05`'s coalesce window, in ms. 250 for a real-time run. **0 for Tier A**,
   * where the log is replayed at 60x: the window is wall-clock, so leaving it
   * at 250 would cap emission at 4 Hz and quietly turn a three-hour volume
   * test into a three-minute one.
   */
  coalesceMs: number;
  note: string | null;
};

export type SpikeSnapshot = {
  runId: number | null;
  running: boolean;
  socket: 'idle' | 'connecting' | 'connected' | 'error' | 'closed';
  lastError: string | null;
  bytes: number;
  lines: number;
  badChecksum: number;
  samples: number;
  rowsWritten: number;
  rawBytes: number;
  startedAt: number | null;
  lastDataAt: number | null;
  lastSampleAt: number | null;
  maxGapMs: number;
  timerTicks: number;
  maxTimerStallMs: number;
  lastLine: string | null;
};

const FLUSH_ROWS = 20;
const FLUSH_MS = 5000;
const TIMER_STALL_MS = 2500; // a 1 Hz probe missing two beats
const TIMER_HEARTBEAT = 60; // ticks between routine heartbeat rows

const state = {
  runId: null as number | null,
  running: false,
  socket: 'idle' as SpikeSnapshot['socket'],
  lastError: null as string | null,
  bytes: 0,
  lines: 0,
  badChecksum: 0,
  samples: 0,
  rowsWritten: 0,
  rawBytes: 0,
  startedAt: null as number | null,
  lastDataAt: null as number | null,
  lastSampleAt: null as number | null,
  maxGapMs: 0,
  timerTicks: 0,
  maxTimerStallMs: 0,
  lastLine: null as string | null,
};

let sock: any = null;
let buffer = '';
let pending: PendingSample[] = [];
let rawPending: string[] = [];
let lastFlushAt = 0;
let seq = 0;
let lastAnchorAt = 0;
let coalesceMs = 250;
let rawFile: File | null = null;
let probe: ReturnType<typeof setInterval> | null = null;
let lastTickAt = 0;
let appStateSub: { remove(): void } | null = null;

/** Latest value seen for each field, so an emitted row is not empty. */
const latest = {
  tws: null as number | null,
  twa: null as number | null,
  stw: null as number | null,
  hdg: null as number | null,
};

const listeners = new Set<(s: SpikeSnapshot) => void>();

export function subscribe(fn: (s: SpikeSnapshot) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function snapshot(): SpikeSnapshot {
  return { ...state };
}

function publish() {
  const s = snapshot();
  for (const fn of listeners) fn(s);
}

// --- NMEA -------------------------------------------------------------------

/**
 * `nmea-sim`'s own logs carry an NMEA v4 TAG block (`\s:ZEUS,c:…*4A\$WIMWV,…`)
 * and its replay mode strips them before writing to the socket. The boat will
 * never send one. Stripping here anyway costs a line and stops a raw log
 * served by some other tool from reading as 100% checksum failures.
 */
function stripTagBlock(line: string): string {
  if (line[0] !== '\\') return line;
  const close = line.indexOf('\\', 1);
  return close < 0 ? line : line.slice(close + 1);
}

function checksumOk(line: string): boolean {
  const star = line.lastIndexOf('*');
  if (star < 0 || star + 3 > line.length) return false;
  let sum = 0;
  for (let i = 1; i < star; i++) sum ^= line.charCodeAt(i);
  return sum === parseInt(line.slice(star + 1, star + 3), 16);
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Returns the anchor kind if this sentence is one of `05`'s anchors. */
function consume(line: string): 'MWV' | 'VHW' | null {
  const star = line.lastIndexOf('*');
  const body = star < 0 ? line : line.slice(0, star);
  const f = body.split(',');
  const type = f[0]?.slice(3); // strip '$' + 2-char talker id

  switch (type) {
    case 'MWV': {
      // $--MWV,angle,reference,speed,units,status
      if (f[2] !== 'T') return null;
      const angle = num(f[1]);
      // Signed ±180 to preserve tack, per `05`.
      latest.twa = angle === null ? null : angle > 180 ? angle - 360 : angle;
      latest.tws = num(f[3]);
      return 'MWV';
    }
    case 'VHW': {
      // $--VHW,headingTrue,T,headingMag,M,speedKn,N,speedKmh,K
      latest.hdg = num(f[1]);
      latest.stw = num(f[5]);
      return 'VHW';
    }
    case 'HDG':
    case 'HDT': {
      latest.hdg = num(f[1]) ?? latest.hdg;
      return null;
    }
    default:
      return null;
  }
}

// --- the capture path -------------------------------------------------------

function emit(anchor: string, now: number) {
  const gapMs = state.lastSampleAt === null ? 0 : now - state.lastSampleAt;
  if (gapMs > state.maxGapMs) state.maxGapMs = gapMs;

  pending.push({
    seq: seq++,
    ts: now,
    gapMs,
    anchor,
    sentences: state.lines,
    tws: latest.tws,
    twa: latest.twa,
    stw: latest.stw,
    hdg: latest.hdg,
  });

  state.samples++;
  state.lastSampleAt = now;
}

function maybeFlush(now: number, force = false) {
  if (state.runId === null) return;
  if (!force && pending.length < FLUSH_ROWS && now - lastFlushAt < FLUSH_MS) {
    return;
  }
  if (pending.length === 0 && rawPending.length === 0) return;

  const batch = pending;
  pending = [];
  const raw = rawPending;
  rawPending = [];
  lastFlushAt = now;

  try {
    insertSamples(state.runId, batch);
    state.rowsWritten += batch.length;
  } catch (e: any) {
    logEvent(state.runId, 'write_error', String(e?.message ?? e));
    state.lastError = `write: ${e?.message ?? e}`;
  }

  if (raw.length > 0 && rawFile) {
    try {
      const text = raw.join('');
      rawFile.write(text, { append: true });
      state.rawBytes += text.length;
    } catch (e: any) {
      logEvent(state.runId, 'raw_error', String(e?.message ?? e));
    }
  }
}

function onData(chunk: any) {
  const now = Date.now();
  // `setEncoding('utf8')` below means this is already a string; the coercion
  // is only there so a stray Buffer cannot silently become "[object Object]".
  const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

  // Diagnostic for the "samples thin under sustained backgrounding" finding
  // (ticket `13`, session 4): logged *before* line-splitting so it shows
  // whether socket `data` delivery itself goes bursty/sparse while
  // backgrounded, independent of the anchor/coalesce logic downstream. One
  // row per chunk — at most a couple of chunks/second even mid-burst, so this
  // is cheap over the short diagnostic run it exists for.
  const dataGapMs = state.lastDataAt === null ? 0 : now - state.lastDataAt;
  if (state.runId !== null) {
    logEvent(state.runId, 'data_event', { bytes: text.length, gapMs: dataGapMs });
  }

  state.bytes += text.length;
  state.lastDataAt = now;

  buffer += text;
  // Guard against a peer that never sends a newline.
  if (buffer.length > 64 * 1024) buffer = buffer.slice(-4096);

  let nl: number;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = stripTagBlock(buffer.slice(0, nl).replace(/\r$/, ''));
    buffer = buffer.slice(nl + 1);
    if (line.length === 0) continue;

    state.lines++;
    state.lastLine = line;
    rawPending.push(`${now}\t${line}\n`);

    if (!checksumOk(line)) {
      state.badChecksum++;
      continue;
    }

    const anchor = consume(line);
    if (anchor && now - lastAnchorAt >= coalesceMs) {
      lastAnchorAt = now;
      emit(anchor, now);
    }
  }

  maybeFlush(now);
  publish();
}

function openSocket(cfg: SpikeConfig) {
  state.socket = 'connecting';
  publish();

  const options: any = { host: cfg.host, port: cfg.port };
  if (cfg.wifiInterface) options.interface = 'wifi';

  sock = TcpSocket.createConnection(options, () => {
    state.socket = 'connected';
    logEvent(state.runId!, 'socket_connect', {
      host: cfg.host,
      port: cfg.port,
      wifi: cfg.wifiInterface,
    });
    publish();
  });

  // NMEA 0183 is ASCII lines; take strings and skip the Buffer round-trip.
  sock.setEncoding('utf8');
  sock.on('data', onData);

  sock.on('error', (err: any) => {
    state.socket = 'error';
    state.lastError = String(err?.message ?? err);
    logEvent(state.runId!, 'socket_error', state.lastError);
    publish();
  });

  sock.on('close', (hadError: boolean) => {
    state.socket = 'closed';
    logEvent(state.runId!, 'socket_close', { hadError });
    publish();
  });
}

/**
 * Item 4's probe, and nothing else depends on it. Records a row only when the
 * interval stalls or every {@link TIMER_HEARTBEAT} beats, so a 3-hour run
 * leaves a readable trail rather than 10,800 rows.
 */
function startTimerProbe() {
  lastTickAt = Date.now();
  probe = setInterval(() => {
    const now = Date.now();
    const delta = now - lastTickAt;
    lastTickAt = now;
    state.timerTicks++;
    if (delta > state.maxTimerStallMs) state.maxTimerStallMs = delta;

    if (state.runId === null) return;
    if (delta > TIMER_STALL_MS) {
      logEvent(state.runId, 'timer_stall', { deltaMs: delta });
    } else if (state.timerTicks % TIMER_HEARTBEAT === 0) {
      logEvent(state.runId, 'timer_heartbeat', {
        ticks: state.timerTicks,
        deltaMs: delta,
      });
    }
  }, 1000);
}

function onAppStateChange(next: AppStateStatus) {
  if (state.runId === null) return;
  logEvent(state.runId, 'app_state', {
    next,
    samples: state.samples,
    rows: state.rowsWritten,
  });
}

// --- the background task ----------------------------------------------------

/**
 * The body handed to `react-native-background-actions`. It runs inside the
 * Headless JS task, i.e. with the foreground service already started, and must
 * not return until the capture is stopped — returning ends the service.
 *
 * It parks on a promise rather than looping, so no polling is required and the
 * whole path stays event-driven.
 */
export function captureTask(cfg: SpikeConfig): Promise<void> {
  return new Promise<void>((resolve) => {
    stopResolver = resolve;

    // Counters are per-run. They live at module scope so the screen can read
    // them, which means a second run would otherwise inherit the first one's
    // totals — and those totals get written into the `run_stop` event, so the
    // stored evidence would be wrong, not just the display.
    Object.assign(state, {
      lastError: null,
      bytes: 0,
      lines: 0,
      badChecksum: 0,
      samples: 0,
      rowsWritten: 0,
      rawBytes: 0,
      lastDataAt: null,
      lastSampleAt: null,
      maxGapMs: 0,
      timerTicks: 0,
      maxTimerStallMs: 0,
      lastLine: null,
    });
    buffer = '';
    pending = [];
    rawPending = [];
    seq = 0;
    lastAnchorAt = 0;
    coalesceMs = cfg.coalesceMs;
    const runId = startRun(
      cfg.host,
      cfg.port,
      cfg.wifiInterface,
      cfg.coalesceMs,
      cfg.note
    );
    state.runId = runId;
    state.running = true;
    state.startedAt = Date.now();
    lastFlushAt = Date.now();

    const dir = new Directory(Paths.document, 'spike');
    if (!dir.exists) dir.create({ intermediates: true });
    rawFile = new File(dir, `run-${runId}.log`);
    if (!rawFile.exists) rawFile.create();

    logEvent(runId, 'run_start', {
      ...cfg,
      rawFile: rawFile.uri,
      platformNow: new Date().toISOString(),
    });

    appStateSub = AppState.addEventListener('change', onAppStateChange);
    startTimerProbe();
    openSocket(cfg);
    publish();
  });
}

let stopResolver: (() => void) | null = null;

/** Tears everything down and lets {@link captureTask} return. */
export function finishCapture() {
  const now = Date.now();
  maybeFlush(now, true);

  if (state.runId !== null) {
    logEvent(state.runId, 'run_stop', {
      samples: state.samples,
      rows: state.rowsWritten,
      lines: state.lines,
      badChecksum: state.badChecksum,
      maxGapMs: state.maxGapMs,
      timerTicks: state.timerTicks,
      maxTimerStallMs: state.maxTimerStallMs,
    });
    endRun(state.runId);
  }

  if (probe) clearInterval(probe);
  probe = null;
  appStateSub?.remove();
  appStateSub = null;

  try {
    sock?.destroy();
  } catch {
    // the socket may already be gone; nothing to do about it
  }
  sock = null;
  buffer = '';

  state.running = false;
  state.socket = 'idle';
  publish();

  stopResolver?.();
  stopResolver = null;
}
