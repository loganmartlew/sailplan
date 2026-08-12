/** Ticket 08's temporary v1 softening. Ticket 21 may change only this value. */
export const AUTO_END_AFTER_MS = 30 * 60_000;

/** A healthy plotter emits anchor sentences at least once a second. */
export const VALID_ANCHOR_SILENCE_MS = 3_000;
export const LOSS_ALERT_AFTER_MS = 5_000;
export const LOSS_REMINDER_AFTER_MS = 60_000;

export const RETRY_DELAYS_MS = [0, 1_000, 2_000, 5_000, 10_000, 15_000] as const;

export function retryDelayMs(attempt: number): number {
  const index = Math.min(Math.max(0, attempt), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}
