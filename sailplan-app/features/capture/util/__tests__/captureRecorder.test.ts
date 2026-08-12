jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: { createConnection: jest.fn() },
}));
jest.mock('../../api/captureSession', () => ({
  createActiveCaptureSession: jest.fn(),
  setCaptureSessionRawLogPath: jest.fn(),
  persistCaptureBatch: jest.fn(),
  endCaptureSession: jest.fn(),
  autoEndCaptureSession: jest.fn(),
  addConnectionEvent: jest.fn(),
  reopenCaptureSession: jest.fn(),
  deleteCaptureSession: jest.fn(),
}));
jest.mock('../rawLog', () => ({ openPendingRawLog: jest.fn() }));
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
import { openPendingRawLog } from '../rawLog';
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

function makeDependencies(withTimers = false) {
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
    openResumeRawLog: jest.fn(async () => rawLog),
    resumeRawLogSize: jest.fn(() => 0),
    deleteSession: jest.fn(async () => {}),
    endSession: jest.fn(async () => {}),
    autoEndSession: jest.fn(async () => {}),
    addConnectionEvent: jest.fn<
      Promise<void>,
      Parameters<RecordingDependencies['addConnectionEvent']>
    >(async () => {}),
    reopenSession: jest.fn(async () => {}),
    setRawLogPath: jest.fn(async () => {}),
    persistBatch: jest.fn<
      Promise<void>,
      Parameters<RecordingDependencies['persistBatch']>
    >(async () => {}),
    startForegroundService: jest.fn(async () => {}),
    stopForegroundService: jest.fn(async () => {}),
    now: jest.fn(() => 1_700_000_000_000),
    monotonicNow: jest.fn(() => 1_000),
    setTimer: (callback: () => void, delayMs: number) => {
      if (!withTimers) return -1 as unknown as ReturnType<typeof setTimeout>;
      const timer = setTimeout(callback, delayMs);
      timer.unref?.();
      return timer;
    },
    clearTimer: (timer: ReturnType<typeof setTimeout>) => {
      if (withTimers) clearTimeout(timer);
    },
  };
  return { socket, listeners, rawLog, session, dependencies };
}

const validAnchor = '$WIMWV,297.5,T,5.6,N,A*2F\r\n';
function connectWithAnchor(fixture: ReturnType<typeof makeDependencies>) {
  fixture.listeners.connect?.();
  fixture.listeners.data?.(validAnchor);
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
  it('publishes the latest live wind and cumulative sample count', async () => {
    const fixture = makeDependencies();
    const onLiveData = jest.fn();
    const started = startCaptureRecording(
      { ...input, onLiveData },
      fixture.dependencies,
    );

    connectWithAnchor(fixture);
    const recording = await started;
    fixture.dependencies.monotonicNow.mockReturnValue(2_000);
    fixture.listeners.data?.(validAnchor);

    expect(onLiveData).toHaveBeenLastCalledWith({
      tws: 5.6,
      twa: -62.5,
      sampleCount: 1,
      lastSampleAt: 1_700_000_000_000,
    });
    expect(recording.live).toEqual({
      tws: 5.6,
      twa: -62.5,
      sampleCount: 1,
      lastSampleAt: 1_700_000_000_000,
    });
  });

  beforeEach(() => jest.clearAllMocks());

  it('opens the raw log on connect and gates session creation on valid anchor data', async () => {
    const fixture = makeDependencies();

    const started = startCaptureRecording(input, fixture.dependencies);

    expect(fixture.dependencies.connect).toHaveBeenCalledWith({
      ...endpoint,
      interface: 'wifi',
      connectTimeout: 31_000,
    });
    fixture.listeners.connect?.();
    expect(fixture.dependencies.openRawLog).toHaveBeenCalledWith(1_700_000_000_000);
    expect(fixture.dependencies.createSession).not.toHaveBeenCalled();
    fixture.listeners.data?.('$WIMWV,297.5,R,5.6,N,A*2A\r\n');
    expect(fixture.dependencies.createSession).not.toHaveBeenCalled();
    fixture.listeners.data?.(validAnchor);

    const recording = await started;
    expect(recording.sessionId).toBe(42);
    expect(recording.startedAt).toBe(1_700_000_000_000);
    expect(fixture.dependencies.createSession).toHaveBeenCalledWith({
      boatProfileId: 7,
      courseId: 9,
      startedAt: 1_700_000_000_000,
    });
    expect(fixture.dependencies.openRawLog).toHaveBeenCalledWith(1_700_000_000_000);
    expect(fixture.dependencies.startForegroundService).toHaveBeenCalledWith(42);
  });

  it('records the raw log path on the session so the file is findable later', async () => {
    const fixture = makeDependencies();
    const started = startCaptureRecording(input, fixture.dependencies);
    connectWithAnchor(fixture);
    const recording = await started;

    expect(fixture.dependencies.setRawLogPath).toHaveBeenCalledWith(
      42,
      'file:///documents/capture/session-42.nmea',
    );
  });

  it('appends socket data verbatim and ends the session cleanly on stop', async () => {
    const fixture = makeDependencies();
    const started = startCaptureRecording(input, fixture.dependencies);
    connectWithAnchor(fixture);
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
    fixture.listeners.data?.(validAnchor);
    resolveSession?.({ id: 42 });

    await started;
    expect(fixture.rawLog.append).toHaveBeenCalledWith(
      '$SDHDG,158.5,,,21.5,E*0A\r\n',
    );
  });

  it('passes a Buffer chunk to the log as bytes rather than decoding it', async () => {
    const fixture = makeDependencies();
    const started = startCaptureRecording(input, fixture.dependencies);
    connectWithAnchor(fixture);
    await started;

    // A byte that is not valid UTF-8, which is what line noise on a marine bus
    // looks like. Decoding this to a string would replace it with U+FFFD and
    // the original byte would be gone from the one file that exists to keep it.
    const chunk = Buffer.from([0x24, 0x47, 0x50, 0xff, 0x0d, 0x0a]);
    fixture.listeners.data?.(chunk);

    expect(fixture.rawLog.append).toHaveBeenCalledWith(chunk);
    const [appended] = fixture.rawLog.append.mock.calls.at(-1)!;
    expect(Buffer.from(appended)).toEqual(chunk);
  });

  it('queues emitted samples to SQLite from socket data without dropping rows', async () => {
    const fixture = makeDependencies();
    let monotonic = 1_000;
    fixture.dependencies.monotonicNow.mockImplementation(() => monotonic);
    const started = startCaptureRecording(input, fixture.dependencies);
    connectWithAnchor(fixture);
    await started;

    monotonic = 2_000;
    fixture.listeners.data?.(validAnchor);
    await flush();

    expect(fixture.dependencies.persistBatch).toHaveBeenCalledWith(
      42,
      [expect.objectContaining({ timestamp: 1_700_000_000_000, tws: 5.6, twa: -62.5 })],
      expect.any(Object),
      expect.any(String),
    );
  });

  it('keeps every 1 Hz emission when anchors arrive at twice race rate', async () => {
    const fixture = makeDependencies();
    let monotonic = 1_000;
    fixture.dependencies.monotonicNow.mockImplementation(() => monotonic);
    const started = startCaptureRecording(input, fixture.dependencies);
    connectWithAnchor(fixture);
    const recording = await started;

    for (let halfSecond = 1; halfSecond <= 200; halfSecond += 1) {
      monotonic = 1_000 + halfSecond * 500;
      fixture.listeners.data?.(validAnchor);
    }
    await recording.stop();

    const written = fixture.dependencies.persistBatch.mock.calls.flatMap(
      call => call[1],
    );
    expect(written).toHaveLength(101);
    expect(new Set(written.map(row => row.timestamp)).size).toBe(101);
  });

  describe('stop', () => {
    it('can be retried after a failure, rather than silently doing nothing', async () => {
      const fixture = makeDependencies();
      fixture.dependencies.endSession.mockRejectedValueOnce(
        new Error('Database is locked'),
      );
      const started = startCaptureRecording(input, fixture.dependencies);
      connectWithAnchor(fixture);
      const recording = await started;

      await expect(recording.stop()).rejects.toThrow('Database is locked');

      // The retry has to really run. A latch set before the first await would
      // resolve this immediately, and the caller would drop the recording while
      // the session row stayed `active` and the service kept running.
      await expect(recording.stop()).resolves.toBeUndefined();
      expect(fixture.dependencies.endSession).toHaveBeenCalledTimes(2);
      expect(fixture.dependencies.endSession).toHaveBeenLastCalledWith(
        42,
        expect.any(Number),
      );
    });

    it('ends the session once when stop is tapped twice in a row', async () => {
      const fixture = makeDependencies();
      const started = startCaptureRecording(input, fixture.dependencies);
      connectWithAnchor(fixture);
      const recording = await started;

      await Promise.all([recording.stop(), recording.stop()]);
      await recording.stop();

      expect(fixture.dependencies.endSession).toHaveBeenCalledTimes(1);
      expect(fixture.dependencies.stopForegroundService).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe('connection loss after recording has started', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('marks the live feed retrying and reconnects immediately on socket loss', async () => {
      const fixture = makeDependencies(true);
      const onConnectionState = jest.fn();
      const started = startCaptureRecording(
        { ...input, onConnectionState } as Parameters<typeof startCaptureRecording>[0],
        fixture.dependencies,
      );
      connectWithAnchor(fixture);
      await started;

      fixture.listeners.error?.(new Error('socket closed'));
      await jest.advanceTimersByTimeAsync(1);

      expect(onConnectionState).toHaveBeenLastCalledWith({
        status: 'retrying',
        gapStartedAt: 1_700_000_000_000,
      });
      expect(fixture.dependencies.connect).toHaveBeenCalledTimes(2);
    });

    it('uses the last valid anchor even when the TCP socket stays open but silent', async () => {
      const fixture = makeDependencies(true);
      const onConnectionState = jest.fn();
      const started = startCaptureRecording(
        { ...input, onConnectionState },
        fixture.dependencies,
      );
      connectWithAnchor(fixture);
      await started;

      await jest.advanceTimersByTimeAsync(2_999);
      expect(onConnectionState).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);

      expect(onConnectionState).toHaveBeenCalledWith({
        status: 'retrying',
        gapStartedAt: 1_700_000_000_000,
      });
      await jest.advanceTimersByTimeAsync(1);
      expect(fixture.dependencies.connect).toHaveBeenCalledTimes(2);
    });

    it('continues the same session and closes the durable gap when anchors recover', async () => {
      const fixture = makeDependencies(true);
      const retry = makeSocket();
      fixture.dependencies.connect
        .mockReturnValueOnce(fixture.socket)
        .mockReturnValueOnce(retry.socket);
      const onConnectionState = jest.fn();
      const onConnectionAlert = jest.fn();
      const started = startCaptureRecording(
        { ...input, onConnectionState, onConnectionAlert },
        fixture.dependencies,
      );
      connectWithAnchor(fixture);
      const recording = await started;

      fixture.listeners.error?.(new Error('socket closed'));
      await jest.advanceTimersByTimeAsync(0);
      retry.listeners.connect?.();
      retry.listeners.data?.(validAnchor);
      await Promise.resolve();
      await Promise.resolve();

      expect(recording.sessionId).toBe(42);
      expect(fixture.dependencies.createSession).toHaveBeenCalledTimes(1);
      expect(fixture.dependencies.addConnectionEvent.mock.calls.map(call => call[2])).toEqual([
        'lost',
        'recovered',
      ]);
      expect(onConnectionState).toHaveBeenLastCalledWith({ status: 'connected' });
      expect(onConnectionAlert).toHaveBeenLastCalledWith('recovered');
    });

    it('auto-ends at the last valid sample without manufacturing gap rows', async () => {
      const fixture = makeDependencies(true);
      const onAutoEnded = jest.fn();
      const onConnectionAlert = jest.fn();
      let wallClock = 1_700_000_000_000;
      fixture.dependencies.now.mockImplementation(() => wallClock);
      const started = startCaptureRecording(
        { ...input, onAutoEnded, onConnectionAlert },
        fixture.dependencies,
      );
      connectWithAnchor(fixture);
      const recording = await started;
      fixture.dependencies.monotonicNow.mockReturnValue(2_000);
      wallClock += 1_000;
      fixture.listeners.data?.(validAnchor);
      await Promise.resolve();
      await Promise.resolve();
      const lastSampleAt = recording.live.lastSampleAt;

      wallClock += 1_000;
      fixture.listeners.error?.(new Error('socket closed'));
      await jest.advanceTimersByTimeAsync(30 * 60_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(lastSampleAt).not.toBeNull();
      const written = fixture.dependencies.persistBatch.mock.calls.flatMap(
        call => call[1],
      );
      const finalSampleAt = Math.max(...written.map(sample => sample.timestamp));
      expect(fixture.dependencies.autoEndSession).toHaveBeenCalledWith(
        42,
        finalSampleAt,
      );
      expect(onAutoEnded).toHaveBeenCalledWith(42, finalSampleAt);
      expect(onConnectionAlert.mock.calls.map(call => call[0])).toEqual([
        'lost',
        'reminder',
        'autoEnded',
      ]);
      expect(written.every(sample => sample.timestamp <= finalSampleAt)).toBe(true);
    });

    it('keeps the session stoppable when the auto-end write fails', async () => {
      const fixture = makeDependencies(true);
      const onAutoEnded = jest.fn();
      fixture.dependencies.autoEndSession.mockRejectedValueOnce(
        new Error('database is locked'),
      );
      const started = startCaptureRecording(
        { ...input, onAutoEnded },
        fixture.dependencies,
      );
      connectWithAnchor(fixture);
      const recording = await started;

      fixture.listeners.error?.(new Error('socket closed'));
      await jest.advanceTimersByTimeAsync(30 * 60_000);
      await jest.advanceTimersByTimeAsync(0);

      // The row is still `active`, so the handle must not have latched itself
      // terminal: stop is the sailor's remaining way to close the session.
      expect(onAutoEnded).not.toHaveBeenCalled();
      await recording.stop();
      expect(fixture.dependencies.endSession).toHaveBeenCalledWith(
        42,
        expect.any(Number),
      );
    });
  });

  it('keeps persisting after a batch write fails mid-race', async () => {
    const fixture = makeDependencies();
    fixture.dependencies.persistBatch.mockRejectedValueOnce(
      new Error('database is locked'),
    );
    const started = startCaptureRecording(input, fixture.dependencies);
    connectWithAnchor(fixture);
    const recording = await started;

    // One transient lock must not silently drop the rest of the recording: a
    // rejected chain would skip every write queued after it.
    for (let index = 1; index <= 3; index += 1) {
      fixture.dependencies.monotonicNow.mockReturnValue(1_000 + index * 1_000);
      fixture.listeners.data?.(validAnchor);
      await flush();
    }
    await recording.stop();

    const written = fixture.dependencies.persistBatch.mock.calls.flatMap(
      call => call[1],
    );
    expect(written.length).toBeGreaterThan(1);
    expect(fixture.dependencies.endSession).toHaveBeenCalledWith(
      42,
      expect.any(Number),
    );
  });

  describe('explicit resume', () => {
    it('waits for valid data, then reopens the same auto-ended session and raw log', async () => {
      const fixture = makeDependencies();
      const started = startCaptureRecording(
        {
          ...input,
          resumeSession: {
            id: 42,
            startedAt: 1_699_999_000_000,
            endedAt: 1_699_999_500_000,
            rawLogPath: fixture.rawLog.path,
          },
        },
        fixture.dependencies,
      );

      fixture.listeners.connect?.();
      expect(fixture.dependencies.reopenSession).not.toHaveBeenCalled();
      fixture.listeners.data?.(validAnchor);
      const recording = await started;

      expect(recording.sessionId).toBe(42);
      expect(recording.startedAt).toBe(1_699_999_000_000);
      expect(fixture.dependencies.createSession).not.toHaveBeenCalled();
      expect(fixture.dependencies.openResumeRawLog).toHaveBeenCalledWith(
        42,
        fixture.rawLog.path,
      );
      expect(fixture.dependencies.reopenSession).toHaveBeenCalledWith(42);
      expect(fixture.dependencies.addConnectionEvent).toHaveBeenCalledWith(
        42,
        1_700_000_000_000,
        'recovered',
      );
    });

    it('never deletes the auto-ended session or its evidence when resume fails', async () => {
      const fixture = makeDependencies();
      fixture.dependencies.startForegroundService.mockRejectedValueOnce(
        new Error('service failed'),
      );
      const started = startCaptureRecording(
        {
          ...input,
          resumeSession: {
            id: 42,
            startedAt: 1_699_999_000_000,
            endedAt: 1_699_999_500_000,
            rawLogPath: fixture.rawLog.path,
          },
        },
        fixture.dependencies,
      );
      connectWithAnchor(fixture);

      await expect(started).rejects.toThrow('service failed');
      expect(fixture.dependencies.deleteSession).not.toHaveBeenCalled();
      expect(fixture.rawLog.remove).not.toHaveBeenCalled();
    });

    it('restores the auto-ended row when the resume fails after reopening it', async () => {
      const fixture = makeDependencies();
      fixture.dependencies.startForegroundService.mockRejectedValueOnce(
        new Error('service failed'),
      );
      const started = startCaptureRecording(
        {
          ...input,
          resumeSession: {
            id: 42,
            startedAt: 1_699_999_000_000,
            endedAt: 1_699_999_500_000,
            rawLogPath: fixture.rawLog.path,
          },
        },
        fixture.dependencies,
      );
      connectWithAnchor(fixture);

      await expect(started).rejects.toThrow('service failed');
      await flush();
      // Left `active`, the session would be neither resumable nor ended — the
      // offer would be gone for good. Its original window goes back verbatim.
      expect(fixture.dependencies.reopenSession).toHaveBeenCalledWith(42);
      expect(fixture.dependencies.autoEndSession).toHaveBeenCalledWith(
        42,
        1_699_999_500_000,
      );
    });

    it('writes no recovered event when the session is no longer resumable', async () => {
      const fixture = makeDependencies();
      fixture.dependencies.reopenSession.mockRejectedValueOnce(
        new Error('Capture session is no longer resumable'),
      );
      const started = startCaptureRecording(
        {
          ...input,
          resumeSession: {
            id: 42,
            startedAt: 1_699_999_000_000,
            endedAt: 1_699_999_500_000,
            rawLogPath: fixture.rawLog.path,
          },
        },
        fixture.dependencies,
      );
      connectWithAnchor(fixture);

      await expect(started).rejects.toThrow('no longer resumable');
      await flush();
      expect(fixture.dependencies.addConnectionEvent).not.toHaveBeenCalled();
      // Nothing was reopened, so nothing needs restoring either.
      expect(fixture.dependencies.autoEndSession).not.toHaveBeenCalled();
    });

    it('measures resumed offsets from the end of the existing log', async () => {
      const fixture = makeDependencies();
      fixture.dependencies.resumeRawLogSize.mockReturnValue(4_096);
      const started = startCaptureRecording(
        {
          ...input,
          resumeSession: {
            id: 42,
            startedAt: 1_699_999_000_000,
            endedAt: 1_699_999_500_000,
            rawLogPath: fixture.rawLog.path,
          },
        },
        fixture.dependencies,
      );
      connectWithAnchor(fixture);
      const recording = await started;
      await recording.stop();

      const written = fixture.dependencies.persistBatch.mock.calls.flatMap(
        call => call[1],
      );
      // Anything below the pre-existing size would point into the part of the
      // race recorded before the outage.
      expect(written.length).toBeGreaterThan(0);
      expect(written[0].rawOffset).toBe(4_096);
    });
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

    it('keeps unlinked raw evidence when connected data never contains a valid anchor', async () => {
      const fixture = makeDependencies();
      const started = startCaptureRecording(input, fixture.dependencies);
      fixture.listeners.connect?.();
      fixture.listeners.data?.('$WIMWV,,T,,,V*13\r\n');
      await flush();
      fixture.listeners.error?.(new Error('Connection reset'));

      await expect(started).rejects.toThrow(CaptureRecordingStartError);
      expect(fixture.dependencies.createSession).not.toHaveBeenCalled();
      expect(fixture.rawLog.close).toHaveBeenCalledTimes(1);
      expect(fixture.rawLog.remove).not.toHaveBeenCalled();
    });

    it('deletes an artefact whose creation raced a socket failure', async () => {
      const fixture = makeDependencies();
      let resolveSession: ((value: { id: number }) => void) | undefined;
      fixture.dependencies.createSession.mockImplementation(
        () => new Promise(resolve => (resolveSession = resolve)),
      );
      const started = startCaptureRecording(input, fixture.dependencies);

      fixture.listeners.connect?.();
      fixture.listeners.data?.(validAnchor);
      fixture.listeners.error?.(new Error('Connection reset'));
      resolveSession?.({ id: 42 });

      await expect(started).rejects.toThrow(CaptureRecordingStartError);
      await flush();
      expect(fixture.dependencies.deleteSession).toHaveBeenCalledWith(42);
      expect(fixture.dependencies.openRawLog).toHaveBeenCalled();
    });

    it('removes an empty raw log, and a throwing remove does not abort cleanup', async () => {
      const fixture = makeDependencies();
      fixture.rawLog.remove.mockImplementation(() => {
        throw new Error('File is gone');
      });
      const started = startCaptureRecording(input, fixture.dependencies);
      // Connected, so the log is open, but not one byte arrived before the
      // socket died: there is no evidence in it worth keeping.
      fixture.listeners.connect?.();
      await flush();
      fixture.listeners.error?.(new Error('Connection reset'));

      await expect(started).rejects.toThrow(CaptureRecordingStartError);
      await flush();
      expect(fixture.rawLog.remove).toHaveBeenCalledTimes(1);
      // Cleanup carried on past the throw rather than stranding the socket.
      expect(fixture.socket.destroy).toHaveBeenCalled();
    });

    it('keeps raw evidence that already holds valid anchors', async () => {
      const fixture = makeDependencies();
      fixture.dependencies.startForegroundService.mockRejectedValueOnce(
        new Error('Service refused to start'),
      );
      const started = startCaptureRecording(input, fixture.dependencies);
      connectWithAnchor(fixture);

      await expect(started).rejects.toThrow(CaptureRecordingStartError);
      // The anchors in this file cannot be re-read off the wire; only the
      // orphaned session row has to go.
      expect(fixture.rawLog.remove).not.toHaveBeenCalled();
      expect(fixture.dependencies.deleteSession).toHaveBeenCalledWith(42);
    });

    it('stops a foreground service that came up after the socket had died', async () => {
      const fixture = makeDependencies();
      let finishServiceStart: (() => void) | undefined;
      fixture.dependencies.startForegroundService.mockImplementation(
        () => new Promise<void>(resolve => (finishServiceStart = resolve)),
      );
      const started = startCaptureRecording(input, fixture.dependencies);
      connectWithAnchor(fixture);
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
      connectWithAnchor(fixture);
      await expect(reasonOf(started)).resolves.toBe('storage');
    });

    it('preserves a reason the foreground service already classified', async () => {
      const fixture = makeDependencies();
      fixture.dependencies.startForegroundService.mockRejectedValueOnce(
        new CaptureRecordingStartError(
          'preparing',
          'service-unavailable',
          new Error('BackgroundService refused to start'),
        ),
      );
      const started = startCaptureRecording(input, fixture.dependencies);
      connectWithAnchor(fixture);
      await expect(reasonOf(started)).resolves.toBe('service-unavailable');
    });
  });

  it('wires the production dependencies to the real modules', async () => {
    const { socket, listeners } = makeSocket();
    (TcpSocket.createConnection as jest.Mock).mockReturnValue(socket);
    (createActiveCaptureSession as jest.Mock).mockResolvedValue({ id: 7 });
    (openPendingRawLog as jest.Mock).mockResolvedValue({
      path: 'file:///documents/capture/session-7.nmea',
      append: jest.fn(),
      close: jest.fn(),
      remove: jest.fn(),
    });
    (setCaptureSessionRawLogPath as jest.Mock).mockResolvedValue(undefined);
    (startCaptureForegroundService as jest.Mock).mockResolvedValue(undefined);

    const started = startCaptureRecording(input);
    listeners.connect?.();
    listeners.data?.(validAnchor);
    const recording = await started;

    expect(TcpSocket.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ interface: 'wifi', connectTimeout: 31_000 }),
      expect.any(Function),
    );
    expect(openPendingRawLog).toHaveBeenCalledWith(expect.any(Number));
    expect(setCaptureSessionRawLogPath).toHaveBeenCalledWith(
      7,
      'file:///documents/capture/session-7.nmea',
    );
    expect(startCaptureForegroundService).toHaveBeenCalledWith(7);
    await recording.stop();
  });
});
