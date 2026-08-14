jest.mock('react-native-background-actions', () => ({
  __esModule: true,
  default: {
    isRunning: jest.fn(() => true),
    updateNotification: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
  },
}));

import BackgroundService from 'react-native-background-actions';
import { Platform } from 'react-native';
import {
  stopCaptureForegroundService,
  updateCaptureForegroundService,
} from '../captureForegroundService';

describe('capture foreground notification', () => {
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await stopCaptureForegroundService();
    jest.useRealTimers();
  });

  it('keeps the connection gap age moving while no plotter data arrives', async () => {
    await updateCaptureForegroundService(
      { tws: 12.3, twa: -88, sampleCount: 12, lastSampleAt: 0 },
      null,
      { status: 'retrying', gapStartedAt: 0 },
    );

    await jest.advanceTimersByTimeAsync(2_000);

    expect(BackgroundService.updateNotification).toHaveBeenLastCalledWith({
      taskTitle: 'Connection lost — retrying',
      taskDesc: 'Gap 3 sec  •  12 samples',
    });
  });
});
