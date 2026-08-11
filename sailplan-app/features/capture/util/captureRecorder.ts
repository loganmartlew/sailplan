import TcpSocket from 'react-native-tcp-socket';
import {
  createActiveCaptureSession,
  deleteCaptureSession,
  endCaptureSession,
  setCaptureSessionRawLogPath,
} from '../api/captureSession';
import { startCaptureForegroundService, stopCaptureForegroundService } from './captureForegroundService';
import { openRawLog, type RawLog } from './rawLog';

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
  stop: () => Promise<void>;
};

type RecordingDependencies = {
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
  setRawLogPath?: (sessionId: number, rawLogPath: string) => Promise<void>;
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

    const cleanupFailedStart = async () => {
      // Detach the current artefacts before awaiting. A late completion of the
      // async setup can then safely call this again and clean only what it made.
      const failedRawLog = rawLog;
      const failedSession = session;
      rawLog = undefined;
      session = undefined;
      try {
        failedRawLog?.close();
        failedRawLog?.remove();
        if (failedSession) await dependencies.deleteSession(failedSession.id);
        if (foregroundServiceStarted) {
          foregroundServiceStarted = false;
          await dependencies.stopForegroundService();
        }
      } finally {
        socket?.destroy();
      }
    };

    const fail = (error: Error) => {
      if (phase === 'started' || phase === 'failed') return;
      phase = 'failed';
      void cleanupFailedStart().finally(() => reject(error));
    };

    const onData = (chunk: string | Buffer) => {
      // react-native-tcp-socket can deliver either a string or a Buffer.
      const rawChunk = typeof chunk === 'string' ? chunk : chunk.toString();
      if (rawLog) rawLog.append(rawChunk);
      else openingData.push(rawChunk);
    };

    const onConnect = () => {
      if (phase !== 'connecting') return;
      phase = 'starting';
      // Listen at the connection edge, rather than after asynchronous SQLite
      // and file setup, so the plotter's first sentences cannot race the log.
      socket?.on('data', onData);
      void (async () => {
        try {
          session = await dependencies.createSession({
            boatProfileId,
            courseId,
            startedAt: dependencies.now(),
          });
          if (hasFailed()) {
            await cleanupFailedStart();
            return;
          }
          rawLog = await dependencies.openRawLog(session.id);
          for (const chunk of openingData) rawLog.append(chunk);
          openingData.length = 0;
          if (hasFailed()) {
            await cleanupFailedStart();
            return;
          }
          await dependencies.setRawLogPath?.(session.id, rawLog.path);
          if (hasFailed()) {
            await cleanupFailedStart();
            return;
          }
          await dependencies.startForegroundService(session.id);
          foregroundServiceStarted = true;
          if (hasFailed()) {
            await cleanupFailedStart();
            return;
          }
          phase = 'started';

          resolve({
            sessionId: session.id,
            stop: async () => {
              if (stopping) return;
              stopping = true;
              rawLog?.close();
              socket?.destroy();
              try {
                await dependencies.endSession(session!.id, dependencies.now());
              } finally {
                await dependencies.stopForegroundService();
              }
            },
          });
        } catch (error) {
          if (!hasFailed()) {
            fail(error instanceof Error ? error : new Error('Could not start recording'));
          }
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
    socket.once('error', error => fail(error ?? new Error('Connection failed')));
    socket.once('timeout', () => fail(new Error('Connection timed out')));
  });
}
