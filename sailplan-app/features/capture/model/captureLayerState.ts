export const STALE_SAIL_STAMP_MS = 15 * 60_000;

export type CaptureConnectionState =
  | { status: 'connected' }
  | { status: 'retrying'; gapStartedAt: number };

export function formatCaptureValue(
  value: number | null,
  kind: 'speed' | 'angle',
): string {
  if (value === null) return '—';
  return kind === 'speed' ? value.toFixed(1) : `${Math.round(value)}°`;
}

export function formatSailStampAge(timestamp: number, now: number): string {
  const age = Math.max(0, now - timestamp);
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ${hours === 1 ? 'hr' : 'hr'} ago`;
}

export function formatConnectionGapAge(ageMs: number): string {
  const seconds = Math.floor(Math.max(0, ageMs) / 1_000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes === 0) return `${remaining} sec`;
  return remaining === 0 ? `${minutes} min` : `${minutes} min ${remaining} sec`;
}

export function isSailStampStale(timestamp: number, now: number): boolean {
  return now - timestamp > STALE_SAIL_STAMP_MS;
}

export function formatCaptureNotification(
  live: CaptureLiveData,
  lastStampAt: number | null,
  now: number,
  connection: CaptureConnectionState = { status: 'connected' },
): { title: string; description: string } {
  if (connection.status === 'retrying') {
    return {
      title: 'Connection lost — retrying',
      description: `Gap ${formatConnectionGapAge(now - connection.gapStartedAt)}  •  ${live.sampleCount.toLocaleString('en-NZ')} ${live.sampleCount === 1 ? 'sample' : 'samples'}`,
    };
  }
  const title = `TWS ${formatCaptureValue(live.tws, 'speed')} kn  •  TWA ${formatCaptureValue(live.twa, 'angle')}`;
  const samples = live.sampleCount.toLocaleString('en-NZ');
  const stamp = lastStampAt === null ? 'No sail stamped' : `Last stamp ${formatSailStampAge(lastStampAt, now)}`;
  return {
    title,
    description: `${samples} ${live.sampleCount === 1 ? 'sample' : 'samples'}  •  ${stamp}`,
  };
}

export function captureStopSessionId(url: string): number | null {
  if (!/[?&]stopCapture=true(?:&|$)/.test(url)) return null;
  const match = /[?&]captureSessionId=(\d+)(?:&|$)/.exec(url);
  return match ? Number(match[1]) : null;
}
import type { CaptureLiveData } from '../util/captureRecorder';
