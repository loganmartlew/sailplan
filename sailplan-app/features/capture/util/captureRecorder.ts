import TcpSocket from 'react-native-tcp-socket';
import {
  createActiveCaptureSession,
  addConnectionEvent,
  autoEndCaptureSession,
  deleteCaptureSession,
  endCaptureSession,
  persistCaptureBatch,
  reopenCaptureSession,
  setCaptureSessionRawLogPath,
} from '../api/captureSession';
import {
  AUTO_END_AFTER_MS,
  LOSS_ALERT_AFTER_MS,
  LOSS_REMINDER_AFTER_MS,
  VALID_ANCHOR_SILENCE_MS,
  retryDelayMs,
} from '../model/connectionLossPolicy';
import type { CaptureConnectionState } from '../model/captureLayerState';
import {
  startCaptureForegroundService,
  stopCaptureForegroundService,
} from './captureForegroundService';
import { openExistingRawLog, openPendingRawLog, openRawLog, type RawLog } from './rawLog';
import {
  classifyWindFrame,
  createCaptureStreamParser,
  type ReplayCaptureSample,
} from './replayCaptureSession';
// Throwaway, ticket `07`. Removed with `captureDiagnostics.ts` once the resume
// ANR is root-caused.
import {
  diagnosticNow,
  recordCaptureDataEvent,
  startCaptureDiagnostics,
  stopCaptureDiagnostics,
} from './captureDiagnostics';
import {
  CaptureRecordingStartError,
  connectFailureReason,
  type CaptureStartReason,
} from '../model/captureRecordingError';

/**
 * Ticket `13` measured a no-route failure taking ~31 s to surface. The socket
 * timeout sits just past it so the connection UX owns the wait rather than
 * racing it.
 */
export const CAPTURE_CONNECTION_TIMEOUT_MS = 31_000;

type Socket = {
  on: (event: 'data', listener: (chunk: string | Buffer) => void) => unknown;
  once: (
    event: 'connect' | 'error' | 'timeout',
    listener: (error?: Error) => void,
  ) => unknown;
  destroy: () => unknown;
};

type Session = { id: number };

/** Whatever the socket handed us, carried to the log without re-encoding. */
type RawChunk = string | Buffer;

/**
 * The size the chunk occupies on disk. A string's `length` counts UTF-16 code
 * units, not bytes, so it under-reports every sentence that is not pure ASCII.
 */
function chunkByteLength(chunk: RawChunk): number {
  return typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
}

export type CaptureRecording = {
  sessionId: number;
  startedAt: number;
  live: CaptureLiveData;
  stop: () => Promise<void>;
};

export type CaptureLiveData = {
  tws: number | null;
  twa: number | null;
  sampleCount: number;
  lastSampleAt: number | null;
};

export type CaptureConnectionAlert =
  | 'lost'
  | 'reminder'
  | 'recovered'
  | 'autoEnded';

export type CaptureRecordingInput = {
  boatProfileId: number;
  courseId: number;
  endpoint: { host: string; port: number };
  onLiveData?: (live: CaptureLiveData) => void;
  onConnectionState?: (state: CaptureConnectionState) => void;
  onConnectionAlert?: (alert: CaptureConnectionAlert) => void;
  onAutoEnded?: (sessionId: number, endedAt: number) => void;
  /** Present only for the explicit offer on an auto-ended session. */
  resumeSession?: {
    id: number;
    startedAt: number;
    rawLogPath: string | null;
  };
};

export type RecordingDependencies = {
  connect: (options: {
    host: string;
    port: number;
    interface: 'wifi';
    connectTimeout: number;
  }) => Socket;
  createSession: (input: {
    boatProfileId: number;
    courseId: number;
    startedAt: number;
  }) => Promise<Session>;
  openRawLog: (startedAt: number) => Promise<RawLog> | RawLog;
  openResumeRawLog: (sessionId: number, path: string | null) => Promise<RawLog> | RawLog;
  deleteSession: (sessionId: number) => Promise<void>;
  endSession: (sessionId: number, endedAt: number) => Promise<void>;
  autoEndSession: (sessionId: number, endedAt: number) => Promise<void>;
  addConnectionEvent: (
    sessionId: number,
    at: number,
    kind: 'lost' | 'recovered',
  ) => Promise<void>;
  reopenSession: (sessionId: number) => Promise<void>;
  setRawLogPath: (sessionId: number, rawLogPath: string) => Promise<void>;
  persistBatch: (
    sessionId: number,
    samples: readonly ReplayCaptureSample[],
    health: ReturnType<typeof createCaptureStreamParser>['health'],
    windFrame: ReturnType<typeof classifyWindFrame>,
  ) => Promise<void>;
  startForegroundService: (sessionId: number) => Promise<void>;
  stopForegroundService: () => Promise<void>;
  now: () => number;
  monotonicNow: () => number;
  setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
};

const productionDependencies: RecordingDependencies = {
  connect: options => TcpSocket.createConnection(options, () => undefined),
  createSession: createActiveCaptureSession,
  openRawLog: openPendingRawLog,
  openResumeRawLog: (sessionId, path) =>
    path ? openExistingRawLog(path) : openRawLog(sessionId),
  deleteSession: deleteCaptureSession,
  endSession: endCaptureSession,
  autoEndSession: autoEndCaptureSession,
  addConnectionEvent,
  reopenSession: reopenCaptureSession,
  setRawLogPath: setCaptureSessionRawLogPath,
  persistBatch: persistCaptureBatch,
  startForegroundService: startCaptureForegroundService,
  stopForegroundService: stopCaptureForegroundService,
  now: Date.now,
  monotonicNow: () => performance.now(),
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: timer => clearTimeout(timer),
};

/**
 * Opens raw evidence on connect, but creates the session only after a valid
 * anchor reaches the pure parser. Samples remain driven by socket data events;
 * the small set of timers exists only for silence detection, finite alerts,
 * retry backoff, and the auto-end horizon.
 */
export function startCaptureRecording(
  {
    boatProfileId,
    courseId,
    endpoint,
    onLiveData,
    onConnectionState,
    onConnectionAlert,
    onAutoEnded,
    resumeSession,
  }: CaptureRecordingInput,
  dependencies: RecordingDependencies = productionDependencies,
): Promise<CaptureRecording> {
  return new Promise((resolve, reject) => {
    let socket: Socket | undefined;
    let session: Session | undefined;
    let rawLog: RawLog | undefined;
    let phase:
      | 'connecting'
      | 'waitingForData'
      | 'starting'
      | 'started'
      | 'failed' = 'connecting';
    let stopInFlight: Promise<void> | undefined;
    let foregroundServiceStarted = false;
    const openingData: RawChunk[] = [];
    let rawLogPromise: Promise<RawLog> | undefined;
    let parser: ReturnType<typeof createCaptureStreamParser> | undefined;
    let connectedMonotonic = 0;
    let startedAt = 0;
    let rawOffset = 0;
    let sessionStartInFlight: Promise<void> | undefined;
    let queuedSamples: ReplayCaptureSample[] = [];
    let persistence = Promise.resolve();
    let preserveRawEvidence = false;
    let connectionGeneration = 0;
    let lossStartedAt: number | null = null;
    let lastValidAnchorAt: number | null = null;
    let retryAttempt = 0;
    let lifecyclePersistence = Promise.resolve();
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAnchorTimer: ReturnType<typeof setTimeout> | undefined;
    let lostAlertTimer: ReturnType<typeof setTimeout> | undefined;
    let reminderTimer: ReturnType<typeof setTimeout> | undefined;
    let autoEndTimer: ReturnType<typeof setTimeout> | undefined;
    let terminal = false;
    const live: CaptureLiveData = {
      tws: null,
      twa: null,
      sampleCount: 0,
      lastSampleAt: null,
    };
    const hasFailed = () => phase === 'failed';

    const clearTimer = (timer: ReturnType<typeof setTimeout> | undefined) => {
      if (timer !== undefined) dependencies.clearTimer(timer);
    };

    const clearConnectionTimers = () => {
      clearTimer(silenceTimer);
      clearTimer(retryTimer);
      clearTimer(retryAnchorTimer);
      clearTimer(lostAlertTimer);
      clearTimer(reminderTimer);
      clearTimer(autoEndTimer);
      silenceTimer = retryTimer = retryAnchorTimer = undefined;
      lostAlertTimer = reminderTimer = autoEndTimer = undefined;
    };

    /**
     * Every step is independently guarded: a failure to remove a setup artefact
     * must not leave an active session row behind. The deliberate exception is
     * a connected stream with no valid anchors; its unlinked raw evidence is
     * retained so an unfamiliar sentence set cannot cost the race.
     */
    const cleanupFailedStart = async () => {
      // Detach the current artefacts before awaiting. A late completion of the
      // async setup can then safely call this again and clean only what it made.
      const failedRawLog = rawLog;
      const failedSession = session;
      rawLog = undefined;
      session = undefined;

      try {
        failedRawLog?.close();
      } catch {
        // Nothing actionable; the removal below is what matters.
      }
      if (!preserveRawEvidence && !resumeSession) {
        try {
          failedRawLog?.remove();
        } catch {
          // An orphaned file is recoverable — ticket `12`'s raw-log manager
          // shows unlinked logs. An orphaned session row is not, so keep going.
        }
      }
      try {
        if (failedSession && !resumeSession) {
          await dependencies.deleteSession(failedSession.id);
        }
      } catch {
        // Already the failure path; the original error is the one to report.
      }
      try {
        if (foregroundServiceStarted) {
          foregroundServiceStarted = false;
          await dependencies.stopForegroundService();
        }
      } catch {
        // As above.
      }
      socket?.destroy();
    };

    const notifyConnectionState = (state: CaptureConnectionState) => {
      try {
        onConnectionState?.(state);
      } catch {
        // Recording state is authoritative; UI chrome is observational.
      }
    };

    const notifyAlert = (alert: CaptureConnectionAlert) => {
      try {
        onConnectionAlert?.(alert);
      } catch {
        // Vibration is deliberately never load-bearing.
      }
    };

    const finishPersistence = async (sessionId: number) => {
      // Before the socket goes: the final flush is the one that carries the
      // last resume window.
      stopCaptureDiagnostics();
      const finalSamples = parser?.finish() ?? [];
      if (finalSamples.length > 0) {
        const latest = finalSamples[finalSamples.length - 1];
        live.tws = latest.tws;
        live.twa = latest.twa;
        live.sampleCount += finalSamples.length;
        live.lastSampleAt = latest.timestamp;
        queuedSamples.push(...finalSamples);
      }
      if (parser) {
        const batch = queuedSamples;
        queuedSamples = [];
        persistence = persistence.then(() =>
          dependencies.persistBatch(
            sessionId,
            batch,
            parser!.health,
            classifyWindFrame(parser!.samples),
          ),
        );
        await persistence;
      }
      await lifecyclePersistence;
      rawLog?.close();
      socket?.destroy();
    };

    const runStop = async (sessionId: number) => {
      if (terminal) return;
      terminal = true;
      clearConnectionTimers();
      try {
        await finishPersistence(sessionId);
        await dependencies.endSession(sessionId, dependencies.now());
        await dependencies.stopForegroundService();
      } catch (error) {
        // A deliberate stop remains retryable when storage or service teardown
        // fails; the caller still owns the live handle.
        terminal = false;
        throw error;
      }
    };

    const runAutoEnd = async (sessionId: number) => {
      if (terminal) return;
      terminal = true;
      clearConnectionTimers();
      const endedAt = live.lastSampleAt ?? lastValidAnchorAt ?? startedAt;
      try {
        await finishPersistence(sessionId);
        const finalEndedAt = live.lastSampleAt ?? endedAt;
        await dependencies.autoEndSession(sessionId, finalEndedAt);
        notifyAlert('autoEnded');
        try {
          onAutoEnded?.(sessionId, finalEndedAt);
        } catch {
          // The durable auto-ended row is the source of truth on relaunch.
        }
      } finally {
        await dependencies.stopForegroundService();
      }
    };

    const fail = (error: Error, reason: CaptureStartReason) => {
      if (phase === 'started' || phase === 'failed') return;
      // Once bytes arrived but no valid anchor ever did, the unlinked raw log
      // is the only record of the unexpected stream and must survive.
      preserveRawEvidence = phase === 'waitingForData';
      phase = 'failed';
      const startError = new CaptureRecordingStartError(
        reason === 'unreachable' || reason === 'refused'
          ? 'connecting'
          : 'preparing',
        reason,
        error,
      );
      void cleanupFailedStart().then(
        () => reject(startError),
        () => reject(startError),
      );
    };

    const queuePersistence = (newSamples: ReplayCaptureSample[]) => {
      if (newSamples.length > 0) {
        const latest = newSamples[newSamples.length - 1];
        live.tws = latest.tws;
        live.twa = latest.twa;
        live.sampleCount += newSamples.length;
        live.lastSampleAt = latest.timestamp;
        try {
          onLiveData?.({ ...live });
        } catch {
          // Live chrome is informational. A rendering or notification callback
          // must never throw through the socket event and interrupt capture.
        }
      }
      if (newSamples.length > 0) queuedSamples.push(...newSamples);
      if (!session || queuedSamples.length === 0 || !parser) return;
      const batch = queuedSamples;
      queuedSamples = [];
      const health = {
        overLengthLines: parser.health.overLengthLines,
        rejects: { ...parser.health.rejects },
        stale: { ...parser.health.stale },
      };
      persistence = persistence.then(() =>
        dependencies.persistBatch(session!.id, batch, health, 'unknown'),
      );
    };

    const startSessionForValidData = () => {
      if (sessionStartInFlight || !parser?.hasValidAnchor || hasFailed()) return;
      phase = 'starting';
      sessionStartInFlight = (async () => {
        try {
          session = resumeSession
            ? { id: resumeSession.id }
            : await dependencies.createSession({
                boatProfileId,
                courseId,
                startedAt,
              });
          if (hasFailed()) return void (await cleanupFailedStart());
          const openedRawLog = await rawLogPromise;
          if (!openedRawLog) throw new Error('Raw log was not opened');
          rawLog = openedRawLog;
          if (hasFailed()) return void (await cleanupFailedStart());
          if (!resumeSession?.rawLogPath) {
            await dependencies.setRawLogPath(session.id, openedRawLog.path);
          }
          if (hasFailed()) return void (await cleanupFailedStart());
          if (resumeSession) {
            await dependencies.addConnectionEvent(
              session.id,
              dependencies.now(),
              'recovered',
            );
            await dependencies.reopenSession(session.id);
          }
          if (hasFailed()) return void (await cleanupFailedStart());
          await dependencies.startForegroundService(session.id);
          foregroundServiceStarted = true;
          if (hasFailed()) return void (await cleanupFailedStart());
          phase = 'started';
          if (lastValidAnchorAt !== null) scheduleAnchorSilence();
          startCaptureDiagnostics(session.id);
          queuePersistence([]);
          const startedSession = session;
          resolve({
            sessionId: startedSession.id,
            startedAt: resumeSession?.startedAt ?? startedAt,
            live,
            stop: () => {
              stopInFlight ??= runStop(startedSession.id).catch(error => {
                stopInFlight = undefined;
                throw error;
              });
              return stopInFlight;
            },
          });
        } catch (error) {
          if (hasFailed()) return;
          const thrown =
            error instanceof Error
              ? error
              : new Error('Could not start recording');
          fail(
            thrown,
            thrown instanceof CaptureRecordingStartError
              ? thrown.reason
              : 'storage',
          );
        }
      })();
    };

    let connectSocket = () => undefined;

    const scheduleRetry = () => {
      if (terminal || lossStartedAt === null) return;
      const delay = retryDelayMs(retryAttempt);
      retryAttempt += 1;
      clearTimer(retryTimer);
      retryTimer = dependencies.setTimer(connectSocket, delay);
    };

    const retryFailed = () => {
      clearTimer(retryAnchorTimer);
      connectionGeneration += 1;
      socket?.destroy();
      scheduleRetry();
    };

    const beginLoss = () => {
      if (phase !== 'started' || terminal) return;
      if (lossStartedAt !== null) {
        retryFailed();
        return;
      }
      lossStartedAt = lastValidAnchorAt ?? live.lastSampleAt ?? dependencies.now();
      notifyConnectionState({ status: 'retrying', gapStartedAt: lossStartedAt });
      if (session) {
        lifecyclePersistence = lifecyclePersistence.then(() =>
          dependencies.addConnectionEvent(session!.id, lossStartedAt!, 'lost'),
        );
      }
      connectionGeneration += 1;
      socket?.destroy();

      const age = Math.max(0, dependencies.now() - lossStartedAt);
      lostAlertTimer = dependencies.setTimer(
        () => notifyAlert('lost'),
        Math.max(0, LOSS_ALERT_AFTER_MS - age),
      );
      reminderTimer = dependencies.setTimer(
        () => notifyAlert('reminder'),
        Math.max(0, LOSS_REMINDER_AFTER_MS - age),
      );
      autoEndTimer = dependencies.setTimer(
        () => {
          if (session) void runAutoEnd(session.id);
        },
        Math.max(0, AUTO_END_AFTER_MS - age),
      );
      retryAttempt = 0;
      scheduleRetry();
    };

    const recover = () => {
      if (lossStartedAt === null || !session || terminal) return;
      const recoveredAt = dependencies.now();
      lossStartedAt = null;
      retryAttempt = 0;
      clearTimer(retryAnchorTimer);
      clearTimer(lostAlertTimer);
      clearTimer(reminderTimer);
      clearTimer(autoEndTimer);
      retryAnchorTimer = lostAlertTimer = reminderTimer = autoEndTimer = undefined;
      lifecyclePersistence = lifecyclePersistence.then(() =>
        dependencies.addConnectionEvent(session!.id, recoveredAt, 'recovered'),
      );
      notifyConnectionState({ status: 'connected' });
      notifyAlert('recovered');
    };

    const scheduleAnchorSilence = () => {
      clearTimer(silenceTimer);
      silenceTimer = dependencies.setTimer(beginLoss, VALID_ANCHOR_SILENCE_MS);
    };

    const onData = (chunk: string | Buffer) => {
      // react-native-tcp-socket can deliver either a string or a Buffer, and
      // both are passed to the log untouched. Decoding a Buffer to a string
      // would round-trip it through UTF-8 and replace every byte the plotter
      // emits that is not valid UTF-8 with U+FFFD — line noise on a marine bus,
      // a half-received sentence, a proprietary sentence carrying high bytes.
      // Those are exactly the cases the raw log exists to preserve, and the
      // substitution is not reversible.
      if (!rawLog) {
        openingData.push(chunk);
      } else {
        try {
          // Ticket `07` (throwaway): the append is synchronous, so its duration
          // is main-thread time. Timing it here is how a resume burst becomes
          // measurable rather than inferred.
          const appendStartedAt = diagnosticNow();
          rawLog.append(chunk);
          recordCaptureDataEvent(
            chunkByteLength(chunk),
            diagnosticNow() - appendStartedAt,
          );
        } catch {
          // A write that fails mid-race must not throw into the socket's emitter
          // and take the recording down with it. Losing a chunk is survivable;
          // losing the rest of the race is not. `08` adds the health counter that
          // makes this visible in review.
        }
      }
      const chunkOffset = rawOffset;
      rawOffset += chunkByteLength(chunk);
      if (parser) {
        const anchorsBefore = parser.validAnchorCount;
        const emitted = parser.pushChunk({
          chunk,
          monotonicElapsedMs: Math.max(
            0,
            dependencies.monotonicNow() - connectedMonotonic,
          ),
          rawOffset: chunkOffset,
        });
        if (parser.validAnchorCount > anchorsBefore) {
          lastValidAnchorAt = dependencies.now();
          recover();
          scheduleAnchorSilence();
        }
        queuePersistence(emitted);
        startSessionForValidData();
      }
    };

    const onConnect = (connectedSocket: Socket, generation: number) => {
      if (phase !== 'connecting') return;
      phase = 'waitingForData';
      // Listen at the connection edge, rather than after asynchronous SQLite
      // and file setup, so the plotter's first sentences cannot race the log.
      connectedSocket.on('data', chunk => {
        if (generation === connectionGeneration && !terminal) onData(chunk);
      });
      startedAt = dependencies.now();
      connectedMonotonic = dependencies.monotonicNow();
      parser = createCaptureStreamParser(startedAt);
      try {
        rawLogPromise = Promise.resolve(
          resumeSession
            ? dependencies.openResumeRawLog(
                resumeSession.id,
                resumeSession.rawLogPath,
              )
            : dependencies.openRawLog(startedAt),
        );
      } catch (error) {
        fail(
          error instanceof Error ? error : new Error('Could not open raw log'),
          'storage',
        );
        return;
      }
      void rawLogPromise.then(
        opened => {
          rawLog = opened;
          try {
            for (const chunk of openingData) rawLog.append(chunk);
            openingData.length = 0;
          } catch (error) {
            fail(
              error instanceof Error
                ? error
                : new Error('Could not write raw log'),
              'storage',
            );
            return;
          }
          if (hasFailed()) void cleanupFailedStart();
        },
        error =>
          fail(
            error instanceof Error
              ? error
              : new Error('Could not open raw log'),
            'storage',
          ),
      );
      // Session setup starts from onData only after parser.hasValidAnchor.
    };

    connectSocket = () => {
      if (terminal) return;
      const generation = ++connectionGeneration;
      const nextSocket = dependencies.connect({
        host: endpoint.host,
        port: endpoint.port,
        interface: 'wifi',
        connectTimeout: CAPTURE_CONNECTION_TIMEOUT_MS,
      });
      socket = nextSocket;
      nextSocket.once('connect', () => {
        if (generation !== connectionGeneration || terminal) return;
        if (phase === 'connecting') {
          onConnect(nextSocket, generation);
          return;
        }
        if (phase === 'started' && lossStartedAt !== null) {
          nextSocket.on('data', chunk => {
            if (generation === connectionGeneration && !terminal) onData(chunk);
          });
          clearTimer(retryAnchorTimer);
          retryAnchorTimer = dependencies.setTimer(
            retryFailed,
            VALID_ANCHOR_SILENCE_MS,
          );
        }
      });
      nextSocket.once('error', error => {
        if (generation !== connectionGeneration || terminal) return;
        const thrown = error ?? new Error('Connection failed');
        if (phase === 'started') {
          if (lossStartedAt === null) beginLoss();
          else retryFailed();
          return;
        }
        fail(thrown, connectFailureReason(thrown));
      });
      nextSocket.once('timeout', () => {
        if (generation !== connectionGeneration || terminal) return;
        if (phase === 'started') {
          if (lossStartedAt === null) beginLoss();
          else retryFailed();
          return;
        }
        fail(new Error('Connection timed out'), 'unreachable');
      });
    };

    connectSocket();
  });
}
