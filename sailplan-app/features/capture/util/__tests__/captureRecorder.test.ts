jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: { createConnection: jest.fn() },
}));
jest.mock('../../api/captureSession', () => ({}));
jest.mock('../rawLog', () => ({}));

import { startCaptureRecording } from '../captureRecorder';

type Listener = (...args: any[]) => void;

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
      removeListener: jest.fn(),
      destroy: jest.fn(),
    },
    listeners,
  };
}

function makeDependencies() {
  const { socket, listeners } = makeSocket();
  const rawLog = {
    path: 'file:///documents/sailplan/capture/session-42.nmea',
    append: jest.fn(),
    close: jest.fn(),
    remove: jest.fn(),
  };
  const session = {
    id: 42,
    boatProfileId: 7,
    courseId: 9,
    startedAt: 1_700_000_000_000,
    rawLogPath: 'file:///documents/sailplan/capture/session-42.nmea',
    status: 'active' as const,
  };
  return {
    socket,
    listeners,
    rawLog,
    session,
    dependencies: {
      connect: jest.fn(() => socket),
      createSession: jest.fn(async () => session),
      openRawLog: jest.fn(async () => rawLog),
      deleteSession: jest.fn(async () => undefined),
      endSession: jest.fn(async () => undefined),
      startForegroundService: jest.fn(async () => undefined),
      stopForegroundService: jest.fn(async () => undefined),
      now: () => session.startedAt,
    },
  };
}

describe('startCaptureRecording', () => {
  const endpoint = { host: '192.168.1.1', port: 10110 };

  it('opens the Wi-Fi socket, then creates the raw-first active session', async () => {
    const fixture = makeDependencies();

    const started = startCaptureRecording(
      { boatProfileId: 7, courseId: 9, endpoint },
      fixture.dependencies,
    );

    expect(fixture.dependencies.connect).toHaveBeenCalledWith({
      ...endpoint,
      interface: 'wifi',
      connectTimeout: 31_000,
    });
    fixture.listeners.connect?.();

    const recording = await started;
    expect(fixture.dependencies.createSession).toHaveBeenCalledWith({
      boatProfileId: 7,
      courseId: 9,
      startedAt: fixture.session.startedAt,
    });
    expect(fixture.dependencies.openRawLog).toHaveBeenCalledWith(42);
    expect(fixture.dependencies.startForegroundService).toHaveBeenCalledWith(42);

    fixture.listeners.data?.('$WIMWV,12.3,R,8.2,N,A*00\r\n');
    expect(fixture.rawLog.append).toHaveBeenCalledWith(
      '$WIMWV,12.3,R,8.2,N,A*00\r\n',
    );

    await recording.stop();
    expect(fixture.rawLog.close).toHaveBeenCalledTimes(1);
    expect(fixture.socket.destroy).toHaveBeenCalledTimes(1);
    expect(fixture.dependencies.endSession).toHaveBeenCalledWith(42, expect.any(Number));
    expect(fixture.dependencies.stopForegroundService).toHaveBeenCalledTimes(1);
  });

  it('leaves no session or raw file when the connection fails', async () => {
    const fixture = makeDependencies();
    const started = startCaptureRecording(
      { boatProfileId: 7, courseId: 9, endpoint },
      fixture.dependencies,
    );

    fixture.listeners.error?.(new Error('Connection refused'));

    await expect(started).rejects.toThrow('Connection refused');
    expect(fixture.dependencies.createSession).not.toHaveBeenCalled();
    expect(fixture.dependencies.openRawLog).not.toHaveBeenCalled();
    expect(fixture.dependencies.startForegroundService).not.toHaveBeenCalled();
    expect(fixture.socket.destroy).toHaveBeenCalledTimes(1);
  });

  it('cleans up an artefact whose creation races a socket failure', async () => {
    const fixture = makeDependencies();
    let resolveSession: ((value: typeof fixture.session) => void) | undefined;
    fixture.dependencies.createSession.mockImplementation(
      () => new Promise(resolve => {
        resolveSession = resolve;
      }),
    );
    const started = startCaptureRecording(
      { boatProfileId: 7, courseId: 9, endpoint },
      fixture.dependencies,
    );

    fixture.listeners.connect?.();
    fixture.listeners.error?.(new Error('Connection reset'));
    resolveSession?.(fixture.session);

    await expect(started).rejects.toThrow('Connection reset');
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.dependencies.deleteSession).toHaveBeenCalledWith(42);
    expect(fixture.dependencies.openRawLog).not.toHaveBeenCalled();
  });

  it('keeps socket data received while the raw log is opening', async () => {
    const fixture = makeDependencies();
    let resolveSession: ((value: typeof fixture.session) => void) | undefined;
    fixture.dependencies.createSession.mockImplementation(
      () => new Promise(resolve => {
        resolveSession = resolve;
      }),
    );
    const started = startCaptureRecording(
      { boatProfileId: 7, courseId: 9, endpoint },
      fixture.dependencies,
    );

    fixture.listeners.connect?.();
    fixture.listeners.data?.('$SDHDG,158.5,,,21.5,E*0A\r\n');
    resolveSession?.(fixture.session);

    await started;
    expect(fixture.rawLog.append).toHaveBeenCalledWith(
      '$SDHDG,158.5,,,21.5,E*0A\r\n',
    );
  });

  it('always stops the foreground service when ending the session write fails', async () => {
    const fixture = makeDependencies();
    fixture.dependencies.endSession.mockRejectedValueOnce(new Error('Database unavailable'));
    const started = startCaptureRecording(
      { boatProfileId: 7, courseId: 9, endpoint },
      fixture.dependencies,
    );
    fixture.listeners.connect?.();

    const recording = await started;
    await expect(recording.stop()).rejects.toThrow('Database unavailable');
    expect(fixture.dependencies.stopForegroundService).toHaveBeenCalledTimes(1);
  });
});
