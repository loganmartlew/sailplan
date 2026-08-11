jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: { createConnection: jest.fn() },
}));
jest.mock('../../api/captureSession', () => ({
  createActiveCaptureSession: jest.fn(),
  setCaptureSessionRawLogPath: jest.fn(),
  endCaptureSession: jest.fn(),
  deleteCaptureSession: jest.fn(),
}));
jest.mock('../rawLog', () => ({ openRawLog: jest.fn() }));
jest.mock('../captureForegroundService', () => ({
  startCaptureForegroundService: jest.fn(),
  stopCaptureForegroundService: jest.fn(),
}));

import TcpSocket from 'react-native-tcp-socket';
import {
  createActiveCaptureSession,
  setCaptureSessionRawLogPath,
} from '../../api/captureSession';
import { startCaptureForegroundService } from '../captureForegroundService';
import { openRawLog } from '../rawLog';
import {
  CaptureRecordingStartError,
  type CaptureStartReason,
} from '../../model/captureRecordingError';
import {
  startCaptureRecording,
  type RecordingDependencies,
} from '../captureRecorder';

type Listener = (...args: any[]) => void;

/** Drains the microtask queue so awaited setup steps have actually run. */
const flush = () => new Promise(resolve => setImmediate(resolve));

function makeSocket() {
  const listeners: Record<string, Listener | undefined> = {};
  return {
    socket: {
      on: jest.fn((event: string, listener: Listener) => {
        listeners[event] = listener;
      }),
      once: jest.fn((event: string, listener: Listener) => {
        listeners[event] = listener;
      }),
      destroy: jest.fn(),
    },
    listeners,
  };
}

function makeDependencies() {
  const { socket, listeners } = makeSocket();
  const rawLog = {
    path: 'file:///documents/capture/session-42.nmea',
    append: jest.fn(),
    close: jest.fn(),
    remove: jest.fn(),
  };
  const session = { id: 42 };
  const dependencies = {
    connect: jest.fn(() => socket),
    createSession: jest.fn(async () => session),
    openRawLog: jest.fn(async () => rawLog),
    deleteSession: jest.fn(async () => {}),
    endSession: jest.fn(async () => {}),
    setRawLogPath: jest.fn(async () => {}),
    startForegroundService: jest.fn(async () => {}),
    stopForegroundService: jest.fn(async () => {}),
    now: jest.fn(() => 1_700_000_000_000),
  };
  return { socket, listeners, rawLog, session, dependencies };
}

const endpoint = { host: '192.168.1.1', port: 10110 };
const input = { boatProfileId: 7, courseId: 9, endpoint };

async function reasonOf(promise: Promise<unknown>): Promise<CaptureStartReason> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CaptureRecordingStartError) return error.reason;
    throw error;
  }
  throw new Error('expected the start to fail');
}

describe('startCaptureRecording', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the Wi-Fi socket, then creates the raw-first active session', async () => {
    const fixture = makeDependencies();

    const started = startCaptureRecording(input, fixture.dependencies);

    expect(fixture.dependencies.connect).toHaveBeenCalledWith({
      ...endpoint,
      interface: 'wifi',
      connectTimeout: 31_000,
    });
    fixture.listeners.connect?.();

    const recording = await started;
    expect(recording.sessionId).toBe(42);
    expect(fixture.dependencies.createSession).toHaveBeenCalledWith({
      boatProfileId: 7,
      courseId: 9,
      startedAt: 1_700_000_000_000,
    });
    expect(fixture.dependencies.openRawLog).toHaveBeenCalledWith(42);
    expect(fixture.dependencies.startForegroundService).toHaveBeenCalledWith(42);
  });

  it('records the raw log path on the session so the file is findable later', async () => {
    const fixture = makeDependencies();
    const started = startCaptureRecording(input, fixture.dependencies);
    fixture.listeners.connect?.();
    await started;

    expect(fixture.dependencies.setRawLogPath).toHaveBeenCalledWith(
      42,
      'file:///documents/capture/session-42.nmea',
    );
  });

  it('appends socket data verbatim and ends the session cleanly on stop', async () => {
    const fixture = makeDependencies();
    const started = startCaptureRecording(input, fixture.dependencies);
    fixture.listeners.connect?.();
    const recording = await started;

    fixture.listeners.data?.('$WIMWV,12.3,R,8.2,N,A*00\r\n');
    expect(fixture.rawLog.append).toHaveBeenCalledWith(
      '$WIMWV,12.3,R,8.2,N,A*00\r\n',
    );

    await recording.stop();
    expect(fixture.rawLog.close).toHaveBeenCalledTimes(1);
    expect(fixture.socket.destroy).toHaveBeenCalledTimes(1);
    expect(fixture.dependencies.endSession).toHaveBeenCalledWith(
      42,
      expect.any(Number),
    );
    expect(fixture.dependencies.stopForegroundService).toHaveBeenCalledTimes(1);
  });

  it('keeps socket data that arrives while the raw log is still opening', async () => {
    const fixture = makeDependencies();
    let resolveSession: ((value: { id: number }) => void) | undefined;
    fixture.dependencies.createSession.mockImplementation(
      () => new Promise(resolve => (resolveSession = resolve)),
    );
    const started = startCaptureRecording(input, fixture.dependencies);

    fixture.listeners.connect?.();
    fixture.listeners.data?.('$SDHDG,158.5,,,21.5,E*0A\r\n');
    resolveSession?.({ id: 42 });

    await started;
    expect(fixture.rawLog.append).toHaveBeenCalledWith(
      '$SDHDG,158.5,,,21.5,E*0A\r\n',
    );
  });

  it('converts a Buffer chunk before appending it', async () => {
    const fixture = makeDependencies();
    const started = startCaptureRecording(input, fixture.dependencies);
    fixture.listeners.connect?.();
    await started;

    fixture.listeners.data?.(Buffer.from('$GPVTG,,T*00\r\n'));
    expect(fixture.rawLog.append).toHaveBeenCalledWith('$GPVTG,,T*00\r\n');
  });

  describe('a failed start leaves nothing behind', () => {
    it('creates no session or raw file when the connection fails', async () => {
      const fixture = makeDependencies();
      const started = startCaptureRecording(input, fixture.dependencies);

      fixture.listeners.error?.(new Error('Connection refused'));

      await expect(started).rejects.toThrow(CaptureRecordingStartError);
      expect(fixture.dependencies.createSession).not.toHaveBeenCalled();
      expect(fixture.dependencies.openRawLog).not.toHaveBeenCalled();
      expect(fixture.dependencies.startForegroundService).not.toHaveBeenCalled();
      expect(fixture.socket.destroy).toHaveBeenCalledTimes(1);
    });

    it('deletes an artefact whose creation raced a socket failure', async () => {
      const fixture = makeDependencies();
      let resolveSession: ((value: { id: number }) => void) | undefined;
      fixture.dependencies.createSession.mockImplementation(
        () => new Promise(resolve => (resolveSession = resolve)),
      );
      const started = startCaptureRecording(input, fixture.dependencies);

      fixture.listeners.connect?.();
      fixture.listeners.error?.(new Error('Connection reset'));
      resolveSession?.({ id: 42 });

      await expect(started).rejects.toThrow(CaptureRecordingStartError);
      await flush();
      expect(fixture.dependencies.deleteSession).toHaveBeenCalledWith(42);
      expect(fixture.dependencies.openRawLog).not.toHaveBeenCalled();
    });

    it('still deletes the session row when removing the raw log throws', async () => {
      const fixture = makeDependencies();
      fixture.rawLog.remove.mockImplementation(() => {
        throw new Error('File is gone');
      });
      fixture.dependencies.startForegroundService.mockRejectedValueOnce(
        new Error('Service refused to start'),
      );
      const started = startCaptureRecording(input, fixture.dependencies);
      fixture.listeners.connect?.();

      await expect(started).rejects.toThrow(CaptureRecordingStartError);
      expect(fixture.rawLog.remove).toHaveBeenCalledTimes(1);
      expect(fixture.dependencies.deleteSession).toHaveBeenCalledWith(42);
    });

    it('stops a foreground service that came up after the socket had died', async () => {
      const fixture = makeDependencies();
      let finishServiceStart: (() => void) | undefined;
      fixture.dependencies.startForegroundService.mockImplementation(
        () => new Promise<void>(resolve => (finishServiceStart = resolve)),
      );
      const started = startCaptureRecording(input, fixture.dependencies);
      fixture.listeners.connect?.();
      await flush();

      // The socket dies while the service is still starting, so the service
      // wins the race and must be torn down again rather than left running.
      fixture.listeners.error?.(new Error('Connection reset'));
      finishServiceStart?.();

      await expect(started).rejects.toThrow(CaptureRecordingStartError);
      await flush();
      expect(fixture.dependencies.stopForegroundService).toHaveBeenCalled();
      expect(fixture.dependencies.deleteSession).toHaveBeenCalledWith(42);
    });
  });

  describe('failure reasons stay distinguishable', () => {
    it('reads a timeout as not being on the boat network', async () => {
      const fixture = makeDependencies();
      const started = startCaptureRecording(input, fixture.dependencies);
      fixture.listeners.timeout?.();
      await expect(reasonOf(started)).resolves.toBe('unreachable');
    });

    it('reads no route as not being on the boat network', async () => {
      const fixture = makeDependencies();
      const started = startCaptureRecording(input, fixture.dependencies);
      fixture.listeners.error?.(new Error('connect EHOSTUNREACH 10.0.0.1'));
      await expect(reasonOf(started)).resolves.toBe('unreachable');
    });

    it('reads a refusal as being on Wi-Fi with no plotter at that address', async () => {
      const fixture = makeDependencies();
      const started = startCaptureRecording(input, fixture.dependencies);
      fixture.listeners.error?.(new Error('connect ECONNREFUSED 10.0.0.1'));
      await expect(reasonOf(started)).resolves.toBe('refused');
    });

    it('reads a database failure as local storage, not a bad address', async () => {
      const fixture = makeDependencies();
      fixture.dependencies.createSession.mockRejectedValueOnce(
        new Error('Database unavailable'),
      );
      const started = startCaptureRecording(input, fixture.dependencies);
      fixture.listeners.connect?.();
      await expect(reasonOf(started)).resolves.toBe('storage');
    });

    it('preserves a reason the foreground service already classified', async () => {
      const fixture = makeDependencies();
      fixture.dependencies.startForegroundService.mockRejectedValueOnce(
        new CaptureRecordingStartError(
          'preparing',
          'notification-permission-denied',
          new Error('POST_NOTIFICATIONS was not granted'),
        ),
      );
      const started = startCaptureRecording(input, fixture.dependencies);
      fixture.listeners.connect?.();
      await expect(reasonOf(started)).resolves.toBe(
        'notification-permission-denied',
      );
    });
  });

  it('wires the production dependencies to the real modules', async () => {
    const { socket, listeners } = makeSocket();
    (TcpSocket.createConnection as jest.Mock).mockReturnValue(socket);
    (createActiveCaptureSession as jest.Mock).mockResolvedValue({ id: 7 });
    (openRawLog as jest.Mock).mockResolvedValue({
      path: 'file:///documents/capture/session-7.nmea',
      append: jest.fn(),
      close: jest.fn(),
      remove: jest.fn(),
    });
    (setCaptureSessionRawLogPath as jest.Mock).mockResolvedValue(undefined);
    (startCaptureForegroundService as jest.Mock).mockResolvedValue(undefined);

    const started = startCaptureRecording(input);
    listeners.connect?.();
    await started;

    expect(TcpSocket.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ interface: 'wifi', connectTimeout: 31_000 }),
      expect.any(Function),
    );
    expect(openRawLog).toHaveBeenCalledWith(7);
    expect(setCaptureSessionRawLogPath).toHaveBeenCalledWith(
      7,
      'file:///documents/capture/session-7.nmea',
    );
    expect(startCaptureForegroundService).toHaveBeenCalledWith(7);
  });
});
