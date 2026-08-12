import TcpSocket from 'react-native-tcp-socket';
import {
  createActiveCaptureSession,
  deleteCaptureSession,
  endCaptureSession,
  persistCaptureBatch,
  setCaptureSessionRawLogPath,
} from '../api/captureSession';
import {
  startCaptureForegroundService,
  stopCaptureForegroundService,
} from './captureForegroundService';
import { openPendingRawLog, type RawLog } from './rawLog';
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
  stop: () => Promise<void>;
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
  deleteSession: (sessionId: number) => Promise<void>;
  endSession: (sessionId: number, endedAt: number) => Promise<void>;
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
};

const productionDependencies: RecordingDependencies = {
  connect: options => TcpSocket.createConnection(options, () => undefined),
  createSession: createActiveCaptureSession,
  openRawLog: openPendingRawLog,
  deleteSession: deleteCaptureSession,
  endSession: endCaptureSession,
  setRawLogPath: setCaptureSessionRawLogPath,
  persistBatch: persistCaptureBatch,
  startForegroundService: startCaptureForegroundService,
  stopForegroundService: stopCaptureForegroundService,
  now: Date.now,
  monotonicNow: () => performance.now(),
};

/**
 * Opens raw evidence on connect, but creates the session only after a valid
 * anchor reaches the pure parser. Emission and persistence are driven entirely
 * by socket data events; backgrounding cannot suspend a timer on this path.
 */
export function startCaptureRecording(
  {
    boatProfileId,
    courseId,
    endpoint,
  }: {
    boatProfileId: number;
    courseId: number;
    endpoint: { host: string; port: number };
  },
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
    const hasFailed = () => phase === 'failed';

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
      if (!preserveRawEvidence) {
        try {
          failedRawLog?.remove();
        } catch {
          // An orphaned file is recoverable — ticket `12`'s raw-log manager
          // shows unlinked logs. An orphaned session row is not, so keep going.
        }
      }
      try {
        if (failedSession) await dependencies.deleteSession(failedSession.id);
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

    const runStop = async (sessionId: number) => {
      // Before the socket goes: the final flush is the one that carries the
      // last resume window.
      stopCaptureDiagnostics();
      try {
        const finalSamples = parser?.finish() ?? [];
        if (finalSamples.length > 0) queuedSamples.push(...finalSamples);
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
        rawLog?.close();
        socket?.destroy();
        await dependencies.endSession(sessionId, dependencies.now());
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
          session = await dependencies.createSession({
            boatProfileId,
            courseId,
            startedAt,
          });
          if (hasFailed()) return void (await cleanupFailedStart());
          const openedRawLog = await rawLogPromise;
          if (!openedRawLog) throw new Error('Raw log was not opened');
          rawLog = openedRawLog;
          if (hasFailed()) return void (await cleanupFailedStart());
          await dependencies.setRawLogPath(session.id, openedRawLog.path);
          if (hasFailed()) return void (await cleanupFailedStart());
          await dependencies.startForegroundService(session.id);
          foregroundServiceStarted = true;
          if (hasFailed()) return void (await cleanupFailedStart());
          phase = 'started';
          startCaptureDiagnostics(session.id);
          queuePersistence([]);
          const startedSession = session;
          resolve({
            sessionId: startedSession.id,
            startedAt,
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
        const emitted = parser.pushChunk({
          chunk,
          monotonicElapsedMs: Math.max(
            0,
            dependencies.monotonicNow() - connectedMonotonic,
          ),
          rawOffset: chunkOffset,
        });
        queuePersistence(emitted);
        startSessionForValidData();
      }
    };

    const onConnect = () => {
      if (phase !== 'connecting') return;
      phase = 'waitingForData';
      // Listen at the connection edge, rather than after asynchronous SQLite
      // and file setup, so the plotter's first sentences cannot race the log.
      socket?.on('data', onData);
      startedAt = dependencies.now();
      connectedMonotonic = dependencies.monotonicNow();
      parser = createCaptureStreamParser(startedAt);
      try {
        rawLogPromise = Promise.resolve(dependencies.openRawLog(startedAt));
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

    socket = dependencies.connect({
      host: endpoint.host,
      port: endpoint.port,
      interface: 'wifi',
      connectTimeout: CAPTURE_CONNECTION_TIMEOUT_MS,
    });
    socket.once('connect', onConnect);
    socket.once('error', error => {
      const thrown = error ?? new Error('Connection failed');
      fail(thrown, connectFailureReason(thrown));
    });
    socket.once('timeout', () =>
      fail(new Error('Connection timed out'), 'unreachable'),
    );
  });
}
