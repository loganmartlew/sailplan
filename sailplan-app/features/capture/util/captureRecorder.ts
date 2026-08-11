import TcpSocket from 'react-native-tcp-socket';
import {
  createActiveCaptureSession,
  deleteCaptureSession,
  endCaptureSession,
  setCaptureSessionRawLogPath,
} from '../api/captureSession';
import {
  startCaptureForegroundService,
  stopCaptureForegroundService,
} from './captureForegroundService';
import { openRawLog, type RawLog } from './rawLog';
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
  openRawLog: (sessionId: number) => Promise<RawLog> | RawLog;
  deleteSession: (sessionId: number) => Promise<void>;
  endSession: (sessionId: number, endedAt: number) => Promise<void>;
  setRawLogPath: (sessionId: number, rawLogPath: string) => Promise<void>;
  startForegroundService: (sessionId: number) => Promise<void>;
  stopForegroundService: () => Promise<void>;
  now: () => number;
};

const productionDependencies: RecordingDependencies = {
  connect: options => TcpSocket.createConnection(options, () => undefined),
  createSession: createActiveCaptureSession,
  openRawLog,
  deleteSession: deleteCaptureSession,
  endSession: endCaptureSession,
  setRawLogPath: setCaptureSessionRawLogPath,
  startForegroundService: startCaptureForegroundService,
  stopForegroundService: stopCaptureForegroundService,
  now: Date.now,
};

/**
 * Connects before creating any persistent capture artefact. Once connected,
 * every socket data event is appended verbatim; there is deliberately no timer
 * or parser on this capture path.
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
    let phase: 'connecting' | 'starting' | 'started' | 'failed' = 'connecting';
    let stopping = false;
    let foregroundServiceStarted = false;
    const openingData: string[] = [];
    const hasFailed = () => phase === 'failed';

    /**
     * Every step is independently guarded: a failure to remove the raw log must
     * not leave the session row behind, because a stranded `active` row is the
     * one thing the ticket promises a failed start never creates.
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
      try {
        failedRawLog?.remove();
      } catch {
        // An orphaned file is recoverable — ticket `12`'s raw-log manager shows
        // unlinked logs. An orphaned session row is not, so keep going.
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

    const fail = (error: Error, reason: CaptureStartReason) => {
      if (phase === 'started' || phase === 'failed') return;
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

    const onData = (chunk: string | Buffer) => {
      // react-native-tcp-socket can deliver either a string or a Buffer.
      const rawChunk = typeof chunk === 'string' ? chunk : chunk.toString();
      if (!rawLog) {
        openingData.push(rawChunk);
        return;
      }
      try {
        rawLog.append(rawChunk);
      } catch {
        // A write that fails mid-race must not throw into the socket's emitter
        // and take the recording down with it. Losing a chunk is survivable;
        // losing the rest of the race is not. `08` adds the health counter that
        // makes this visible in review.
      }
    };

    const onConnect = () => {
      if (phase !== 'connecting') return;
      phase = 'starting';
      // Listen at the connection edge, rather than after asynchronous SQLite
      // and file setup, so the plotter's first sentences cannot race the log.
      socket?.on('data', onData);
      void (async () => {
        try {
          const startedAt = dependencies.now();
          session = await dependencies.createSession({
            boatProfileId,
            courseId,
            startedAt,
          });
          if (hasFailed()) return void (await cleanupFailedStart());

          rawLog = await dependencies.openRawLog(session.id);
          for (const chunk of openingData) rawLog.append(chunk);
          openingData.length = 0;
          if (hasFailed()) return void (await cleanupFailedStart());

          await dependencies.setRawLogPath(session.id, rawLog.path);
          if (hasFailed()) return void (await cleanupFailedStart());

          await dependencies.startForegroundService(session.id);
          foregroundServiceStarted = true;
          if (hasFailed()) return void (await cleanupFailedStart());

          phase = 'started';
          const startedSession = session;

          resolve({
            sessionId: startedSession.id,
            startedAt,
            stop: async () => {
              if (stopping) return;
              stopping = true;
              try {
                rawLog?.close();
                socket?.destroy();
                await dependencies.endSession(
                  startedSession.id,
                  dependencies.now(),
                );
              } finally {
                await dependencies.stopForegroundService();
              }
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
