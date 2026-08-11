import { useCaptureRecordingStore } from '../store/captureRecordingStore';

/**
 * Bottom space scroll content needs while the recording pill is visible.
 * Includes the pill, its gap above the tab bar, and a little breathing room so
 * the final control can be scrolled fully clear of the overlay.
 */
const CAPTURE_RECORDING_INSET = 80;

export function useCaptureInset(): number {
  return useCaptureRecordingStore(state =>
    state.recording ? CAPTURE_RECORDING_INSET : 0,
  );
}
