import { Directory, File, Paths } from 'expo-file-system';
import { getRawLogFileName } from '../model/rawLogManager';

export interface RawLog {
  path: string;
  /**
   * Bytes are written as bytes. `File.write` accepts a `Uint8Array`, so a
   * Buffer straight off the socket never has to become a JS string — the
   * decode-then-re-encode round trip is what would make the log lossy.
   */
  append: (chunk: string | Uint8Array) => void;
  close: () => void;
  remove: () => void;
}

const rawLogDirectory = new Directory(Paths.document, 'capture');

export function getRawLogDirectory(): Directory {
  return rawLogDirectory;
}

/**
 * Raw NMEA is evidence, not cache: keep it under the app document directory
 * in a discoverable filename. New recordings first use a start-time name
 * because raw evidence opens before valid anchor data permits a session row;
 * resumed sessions keep their stable session-id filename. Never the Android-
 * reclaimable cache directory.
 *
 * Writes go straight through on every socket `data` event rather than being
 * buffered. The log's whole value is that it is lossless, and a buffer is a
 * window in which a crash costs sentences that cannot be re-read off the wire.
 */
export function openRawLog(sessionId: number): RawLog {
  return openNamedRawLog(getRawLogFileName(sessionId));
}

/** Reopens the exact evidence file already attached to an auto-ended session. */
export function openExistingRawLog(path: string): RawLog {
  return openFile(new File(path));
}

/**
 * Bytes already in an existing log. A resume appends rather than truncating, so
 * this is the origin its `rawOffset` values have to be measured from — without
 * it a resumed session mixes offsets from two different origins in one column.
 */
export function rawLogSizeBytes(path: string): number {
  const file = new File(path);
  return file.exists ? file.size ?? 0 : 0;
}

/** Opens raw evidence before a valid anchor permits creation of a session. */
export function openPendingRawLog(startedAt: number): RawLog {
  return openNamedRawLog(`pending-${startedAt}.nmea`);
}

function openNamedRawLog(fileName: string): RawLog {
  rawLogDirectory.create({ idempotent: true, intermediates: true });
  return openFile(new File(rawLogDirectory, fileName));
}

function openFile(file: File): RawLog {
  // Deliberately never truncates: reopening a session's log appends to it, so
  // `08`'s resume cannot destroy the part of the race already recorded.
  if (!file.exists) file.create({ intermediates: true });

  return {
    path: file.uri,
    append: chunk => file.write(chunk, { append: true }),
    // File.write is synchronous and append-only. There is no buffered writer to
    // flush, but preserving this lifecycle boundary lets a future native writer
    // close a handle without changing recording orchestration.
    close: () => undefined,
    remove: () => file.delete(),
  };
}
