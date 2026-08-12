import { AppState, type AppStateStatus } from 'react-native';

/**
 * THROWAWAY — diagnostic scaffolding for ticket `07`, the resume ANR.
 *
 * Device spike `13` reproduced `Input dispatching timed out … waited 5000ms for
 * FocusEvent`, logged 5 s after the app's own `app_state → active`, and could
 * not root-cause it. Its leading hypothesis was that socket `data` delivery to
 * JS is deferred while backgrounded and arrives as a catch-up burst on resume,
 * blocking the main thread past Android's 5 s input-dispatch timeout. The spike
 * rig that would have measured that has since been deleted, so the measurement
 * has to happen in the real capture path.
 *
 * This file exists to answer one question — *what runs in the five seconds
 * after `active`* — and comes out again once `07` is closed. It is not a
 * logging framework and nothing outside `features/capture` should import it.
 *
 * **Observer effect is the whole design problem.** The thing under suspicion is
 * main-thread work on resume, so the recording path must stay close to free:
 * events are pushed into a preallocated ring as bare numbers with no string
 * formatting, and nothing is serialised, logged or written until a flush. Flush
 * deliberately never happens on `active` — it runs on the way *out* to
 * background and on stop, so the resume window is measured rather than
 * disturbed.
 */
export const CAPTURE_DIAGNOSTICS_ENABLED =
  __DEV__ && process.env.NODE_ENV !== 'test';

/** A race-length run at ~1 Hz is ~10 k events; this holds well over three hours. */
const RING_CAPACITY = 50_000;

/** The window after `active` that ticket `07` is actually about. */
const RESUME_WINDOW_MS = 10_000;

const EVENT_APP_STATE = 1;
const EVENT_SOCKET_DATA = 2;
const EVENT_TIMER_TICK = 3;
/**
 * The app state at the moment recording started. Kept in the trace as context,
 * but deliberately *not* an `EVENT_APP_STATE`: recording starts from the
 * foreground, so counting it as a transition to `active` invents a resume at
 * t=0 that never happened and reports the first ten seconds of ordinary
 * recording as if it were a catch-up burst.
 */
const EVENT_SESSION_START = 4;

const APP_STATE_CODES: Record<string, number> = {
  active: 0,
  background: 1,
  inactive: 2,
  unknown: 3,
  extension: 4,
};
const APP_STATE_NAMES = [
  'active',
  'background',
  'inactive',
  'unknown',
  'extension',
];

/**
 * `performance.now()` is monotonic and unaffected by clock changes, which
 * matters over a race-length run. Falls back to wall clock if the runtime does
 * not expose it.
 */
const monotonicNow: () => number =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();

type Ring = {
  kind: Int8Array;
  at: Float64Array;
  /** Byte length for socket data, app-state code for transitions, else 0. */
  a: Float64Array;
  /** Append duration in ms for socket data, else 0. */
  b: Float64Array;
  /** Total events ever written; the ring holds the last `RING_CAPACITY`. */
  written: number;
};

type Diagnostics = {
  sessionId: number;
  /** Wall clock and monotonic reading taken together, to align with logcat. */
  wallClockOrigin: number;
  monotonicOrigin: number;
  ring: Ring;
  subscription: { remove: () => void } | null;
  flushCount: number;
  /** Absolute ring position already written to the sidecar. */
  flushedThrough: number;
};

let current: Diagnostics | null = null;

function createRing(): Ring {
  return {
    kind: new Int8Array(RING_CAPACITY),
    at: new Float64Array(RING_CAPACITY),
    a: new Float64Array(RING_CAPACITY),
    b: new Float64Array(RING_CAPACITY),
    written: 0,
  };
}

/**
 * The hot path. Four typed-array stores and an increment — no allocation, no
 * formatting, no branching beyond the enabled check.
 */
function push(kind: number, a: number, b: number): void {
  if (!current) return;
  const { ring } = current;
  const index = ring.written % RING_CAPACITY;
  ring.kind[index] = kind;
  ring.at[index] = monotonicNow() - current.monotonicOrigin;
  ring.a[index] = a;
  ring.b[index] = b;
  ring.written += 1;
}

type Event = { kind: number; at: number; a: number; b: number };

/**
 * Drains the ring oldest-first, from absolute position `from` onwards.
 *
 * Reading only what is new matters: a flush happens on every backgrounding, so
 * re-dumping the whole ring each time makes the sidecar grow with the square of
 * the run. A 15-minute run already produced 570 KB of mostly duplicate JSON.
 */
function readEvents(diagnostics: Diagnostics, from: number): Event[] {
  const { ring } = diagnostics;
  // Anything older than the ring's capacity has been overwritten and is gone.
  const start = Math.max(from, ring.written - RING_CAPACITY);
  const events: Event[] = [];

  for (let position = start; position < ring.written; position += 1) {
    const index = position % RING_CAPACITY;
    events.push({
      kind: ring.kind[index],
      at: ring.at[index],
      a: ring.a[index],
      b: ring.b[index],
    });
  }

  return events;
}

/**
 * Ticket `07`'s first checklist box: *what runs ~5 s after `app_state →
 * active`*. For each resume in the flushed window, this is the answer — how
 * much data landed, how long the synchronous raw-log appends took in total, and
 * the worst single append.
 */
function summariseResumeWindows(events: Event[]): string[] {
  const lines: string[] = [];

  events.forEach((event, position) => {
    if (event.kind !== EVENT_APP_STATE || event.a !== APP_STATE_CODES.active) {
      return;
    }

    let dataEvents = 0;
    let bytes = 0;
    let appendMs = 0;
    let worstAppendMs = 0;
    let timerTicks = 0;

    for (let next = position + 1; next < events.length; next += 1) {
      const candidate = events[next];
      if (candidate.at - event.at > RESUME_WINDOW_MS) break;
      if (candidate.kind === EVENT_SOCKET_DATA) {
        dataEvents += 1;
        bytes += candidate.a;
        appendMs += candidate.b;
        worstAppendMs = Math.max(worstAppendMs, candidate.b);
      } else if (candidate.kind === EVENT_TIMER_TICK) {
        timerTicks += 1;
      }
    }

    lines.push(
      `  resume @${(event.at / 1000).toFixed(1)}s → ` +
        `${dataEvents} data events, ${bytes} bytes, ` +
        `appends ${appendMs.toFixed(1)}ms total / ${worstAppendMs.toFixed(1)}ms worst, ` +
        `${timerTicks} timer ticks`,
    );
  });

  return lines;
}

function formatSummary(
  diagnostics: Diagnostics,
  events: Event[],
  reason: string,
): string {
  // Events lost because the ring wrapped before this flush could read them.
  const dropped = Math.max(
    0,
    diagnostics.ring.written - RING_CAPACITY - diagnostics.flushedThrough,
  );
  const dataEvents = events.filter(event => event.kind === EVENT_SOCKET_DATA);
  const bytes = dataEvents.reduce((total, event) => total + event.a, 0);
  const appendMs = dataEvents.reduce((total, event) => total + event.b, 0);
  const transitions = events.filter(event => event.kind === EVENT_APP_STATE);
  const resumes = transitions.filter(
    event => event.a === APP_STATE_CODES.active,
  );

  const header = [
    `[capture-diag] flush #${diagnostics.flushCount} (${reason}) ` +
      `session ${diagnostics.sessionId}`,
    `  ${events.length} events${dropped ? ` (+${dropped} dropped)` : ''}, ` +
      `${transitions.length} app-state transitions, ${resumes.length} resumes`,
    `  ${dataEvents.length} data events, ${bytes} bytes, ` +
      `${appendMs.toFixed(1)}ms in synchronous appends`,
  ];

  return [...header, ...summariseResumeWindows(events)].join('\n');
}

/**
 * The console line is what a tethered run reads in logcat; the sidecar file is
 * what survives an unattended race-length run whose app never comes back. Both
 * happen only at flush, and flush never happens on `active`.
 */
function flush(reason: string): void {
  if (!current) return;
  const diagnostics = current;
  diagnostics.flushCount += 1;

  try {
    const events = readEvents(diagnostics, diagnostics.flushedThrough);
    // eslint-disable-next-line no-console
    console.log(formatSummary(diagnostics, events, reason));
    writeSidecar(diagnostics, events, reason);
    // Only after a successful write, so a failed flush is retried by the next
    // one rather than silently losing its events.
    diagnostics.flushedThrough = diagnostics.ring.written;
  } catch {
    // Diagnostics must never take a recording down. A lost flush costs a
    // measurement; a throw here would cost the race.
  }
}

function writeSidecar(
  diagnostics: Diagnostics,
  events: Event[],
  reason: string,
): void {
  // Required lazily so this file stays importable in unit tests, which mock the
  // recorder's file dependencies but have no reason to know about diagnostics.
  const { File } =
    require('expo-file-system') as typeof import('expo-file-system');
  const { getRawLogDirectory } =
    require('./rawLog') as typeof import('./rawLog');

  const file = new File(
    getRawLogDirectory(),
    `session-${diagnostics.sessionId}.diag.jsonl`,
  );
  if (!file.exists) file.create({ intermediates: true });

  // One JSON object per line: a flush header, then every event. `.jsonl` rather
  // than `.nmea` keeps this invisible to `12`'s raw-log manager, which lists the
  // capture directory filtered on `.nmea`.
  const lines = [
    JSON.stringify({
      t: 'flush',
      reason,
      flush: diagnostics.flushCount,
      sessionId: diagnostics.sessionId,
      wallClockOrigin: diagnostics.wallClockOrigin,
      written: diagnostics.ring.written,
    }),
    ...events.map(event =>
      JSON.stringify({
        t:
          event.kind === EVENT_APP_STATE
            ? 'appState'
            : event.kind === EVENT_SESSION_START
              ? 'sessionStart'
              : event.kind === EVENT_SOCKET_DATA
                ? 'data'
                : 'timer',
        at: Number(event.at.toFixed(3)),
        ...(event.kind === EVENT_APP_STATE || event.kind === EVENT_SESSION_START
          ? { state: APP_STATE_NAMES[event.a] ?? 'unknown' }
          : event.kind === EVENT_SOCKET_DATA
            ? { bytes: event.a, appendMs: Number(event.b.toFixed(3)) }
            : {}),
      }),
    ),
  ];

  file.write(`${lines.join('\n')}\n`, { append: true });
}

function onAppStateChange(state: AppStateStatus): void {
  push(EVENT_APP_STATE, APP_STATE_CODES[state] ?? APP_STATE_CODES.unknown, 0);
  // Never on `active`: serialising here would add main-thread work to exactly
  // the window being measured. Backgrounding is the safe moment, and every
  // resume is followed by one eventually.
  if (state === 'background') flush('background');
}

/**
 * Begins recording against a live capture session. Safe to call when disabled —
 * it does nothing and every other entry point becomes a no-op.
 */
export function startCaptureDiagnostics(sessionId: number): void {
  if (!CAPTURE_DIAGNOSTICS_ENABLED) return;
  stopCaptureDiagnostics();

  current = {
    sessionId,
    wallClockOrigin: Date.now(),
    monotonicOrigin: monotonicNow(),
    ring: createRing(),
    subscription: null,
    flushCount: 0,
    flushedThrough: 0,
  };

  try {
    current.subscription = AppState.addEventListener(
      'change',
      onAppStateChange,
    );
    push(
      EVENT_SESSION_START,
      APP_STATE_CODES[AppState.currentState] ?? APP_STATE_CODES.unknown,
      0,
    );
  } catch {
    // As everywhere else here: a broken probe must not break the recording.
  }
}

/**
 * Monotonic reading for timing a single synchronous operation on the capture
 * path, or `0` when diagnostics are off so a disabled build pays nothing.
 */
export function diagnosticNow(): number {
  return CAPTURE_DIAGNOSTICS_ENABLED ? monotonicNow() : 0;
}

/** Records one socket `data` event and the cost of its synchronous append. */
export function recordCaptureDataEvent(
  byteLength: number,
  appendMs: number,
): void {
  if (!CAPTURE_DIAGNOSTICS_ENABLED) return;
  push(EVENT_SOCKET_DATA, byteLength, appendMs);
}

/**
 * Records a tick of the capture layer's 1 Hz duration timer — a JS interval,
 * which `JavaTimerManager` stalls while backgrounded. If a backlog of ticks
 * lands alongside the data burst on resume, that is a second contributor to the
 * same blocked main thread and this is what shows it.
 */
export function recordCaptureTimerTick(): void {
  if (!CAPTURE_DIAGNOSTICS_ENABLED) return;
  push(EVENT_TIMER_TICK, 0, 0);
}

export function stopCaptureDiagnostics(): void {
  if (!current) return;
  flush('stop');
  try {
    current.subscription?.remove();
  } catch {
    // Nothing actionable.
  }
  current = null;
}
