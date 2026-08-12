import { Vibration } from 'react-native';
import type { CaptureConnectionAlert } from './captureRecorder';

const PATTERNS: Record<CaptureConnectionAlert, number | number[]> = {
  lost: [0, 250, 150, 250],
  reminder: [0, 400, 200, 400],
  recovered: 120,
  autoEnded: [0, 500, 200, 500, 200, 500],
};

export function vibrateForCaptureAlert(alert: CaptureConnectionAlert): void {
  Vibration.vibrate(PATTERNS[alert], false);
}
