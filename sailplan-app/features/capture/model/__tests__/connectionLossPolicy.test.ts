import {
  AUTO_END_AFTER_MS,
  LOSS_ALERT_AFTER_MS,
  LOSS_REMINDER_AFTER_MS,
  RETRY_DELAYS_MS,
  retryDelayMs,
} from '../connectionLossPolicy';

describe('connection loss policy', () => {
  it('retries immediately, then follows the bounded backoff ladder', () => {
    expect(Array.from({ length: 9 }, (_, attempt) => retryDelayMs(attempt))).toEqual([
      0,
      1_000,
      2_000,
      5_000,
      10_000,
      15_000,
      15_000,
      15_000,
      15_000,
    ]);
    expect(RETRY_DELAYS_MS).toEqual([0, 1_000, 2_000, 5_000, 10_000, 15_000]);
  });

  it('defaults auto-end to the ticket-08 thirty-minute softening', () => {
    expect(AUTO_END_AFTER_MS).toBe(30 * 60_000);
  });

  it('defines only the five-second alert and one-minute reminder thresholds', () => {
    expect(LOSS_ALERT_AFTER_MS).toBe(5_000);
    expect(LOSS_REMINDER_AFTER_MS).toBe(60_000);
  });
});
