export type CaptureStartStage = 'connecting' | 'preparing';

/**
 * Preserves whether a failed start reached the plotter before it failed.
 * The UI must not present a local setup or permission failure as a bad
 * network address.
 */
export class CaptureRecordingStartError extends Error {
  constructor(
    readonly stage: CaptureStartStage,
    readonly originalError: Error,
  ) {
    super(originalError.message);
    this.name = 'CaptureRecordingStartError';
  }
}
