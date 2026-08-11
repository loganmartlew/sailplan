/** Whether a failed start reached the plotter before it failed. */
export type CaptureStartStage = 'connecting' | 'preparing';

/**
 * What actually went wrong, as a code rather than a message. The UI must not
 * present a local setup or permission failure as a bad network address, and
 * matching on copy would couple the message the user reads to the branch that
 * chooses it.
 */
export type CaptureStartReason =
  /** Never reached the boat network — no route, or not on the boat's Wi-Fi. */
  | 'unreachable'
  /** Reached Wi-Fi; nothing accepted a connection at the saved address. */
  | 'refused'
  /** Connected, but Android would not grant the recording notification. */
  | 'notification-permission-denied'
  /** Connected, but the foreground service would not start. */
  | 'service-unavailable'
  /** Connected, but local session or raw-log setup failed. */
  | 'storage';

export class CaptureRecordingStartError extends Error {
  constructor(
    readonly stage: CaptureStartStage,
    readonly reason: CaptureStartReason,
    readonly cause: Error,
  ) {
    super(cause.message);
    this.name = 'CaptureRecordingStartError';
  }
}

/**
 * A connect-stage failure only tells us *that* the socket never came up. The
 * ~31 s no-route timeout and an immediate refusal mean different things to the
 * sailor: one is "you are not on the boat's Wi-Fi", the other is "you are, but
 * the plotter is not at that address".
 */
export function connectFailureReason(error: Error): CaptureStartReason {
  return /timed out|timeout|no route|network is unreachable|EHOSTUNREACH|ENETUNREACH/i.test(
    error.message,
  )
    ? 'unreachable'
    : 'refused';
}
