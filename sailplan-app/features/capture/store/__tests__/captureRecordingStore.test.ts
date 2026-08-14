jest.mock('~/lib/db', () => ({ db: { query: {} } }));
jest.mock('../../api/captureSession', () => ({
  endCaptureSession: jest.fn(async () => undefined),
}));
jest.mock('../../api/sailStamp', () => ({
  getLatestSailStampHistory: jest.fn(async () => ({
    id: 17,
    sailId: 4,
    sailName: 'Screecher',
    sailColor: '#123456',
    timestamp: 1_700_000_000_000,
  })),
}));
jest.mock('../../util/batteryOptimization', () => ({
  hasAskedBatteryExemption: jest.fn(() => true),
  requestBatteryExemption: jest.fn(async () => undefined),
}));
jest.mock('../../util/captureAlerts', () => ({
  vibrateForCaptureAlert: jest.fn(),
}));
jest.mock('../../util/captureNotifications', () => ({
  dismissNotificationsForCapture: jest.fn(async () => undefined),
  postCaptureAutoEndedNotification: jest.fn(async () => 'notification-1'),
}));
jest.mock('../../util/captureForegroundService', () => ({
  requestCaptureNotificationPermission: jest.fn(async () => true),
  stopCaptureForegroundService: jest.fn(async () => undefined),
  updateCaptureForegroundService: jest.fn(async () => undefined),
}));
jest.mock('../../util/captureRecorder', () => ({
  startCaptureRecording: jest.fn(async () => ({
    sessionId: 42,
    startedAt: 1_600_000_000_000,
    live: {
      tws: 12.3,
      twa: -88,
      sampleCount: 25,
      lastSampleAt: 1_700_000_010_000,
    },
    stop: jest.fn(async () => undefined),
  })),
}));

import { updateCaptureForegroundService } from '../../util/captureForegroundService';
import { useCaptureRecordingStore } from '../captureRecordingStore';

describe('capture recording store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCaptureRecordingStore.setState({
      recording: null,
      live: { tws: null, twa: null, sampleCount: 0, lastSampleAt: null },
      connection: { status: 'connected' },
      lastStamp: null,
      isConnecting: false,
      isStopping: false,
      failure: null,
    });
  });

  it('restores the last sail stamp when an auto-ended session resumes', async () => {
    await useCaptureRecordingStore.getState().resume(
      {
        id: 42,
        boatProfileId: 7,
        name: 'Friday race',
        courseId: 9,
        startedAt: 1_600_000_000_000,
        endedAt: 1_700_000_000_000,
        status: 'autoEnded',
        resumeDismissedAt: null,
        rawLogPath: 'file:///capture-42.nmea',
        windFrame: 'water',
        healthCounters: '{}',
        notes: '',
      },
      { host: '192.168.1.1', port: 10110 },
    );

    expect(useCaptureRecordingStore.getState().lastStamp).toEqual({
      id: 17,
      sailId: 4,
      sailName: 'Screecher',
      sailColor: '#123456',
      timestamp: 1_700_000_000_000,
    });
    expect(updateCaptureForegroundService).toHaveBeenLastCalledWith(
      expect.objectContaining({ sampleCount: 25 }),
      1_700_000_000_000,
      { status: 'connected' },
    );
  });
});
