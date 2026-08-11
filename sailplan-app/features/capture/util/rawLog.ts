import { Directory, File, Paths } from 'expo-file-system';
import { getRawLogFileName } from '../model/rawLogManager';

export interface RawLog {
  path: string;
  append: (chunk: string) => void;
  close: () => void;
  remove: () => void;
}

const rawLogDirectory = new Directory(Paths.document, 'capture');

export function getRawLogDirectory(): Directory {
  return rawLogDirectory;
}

/**
 * Raw NMEA is evidence, not cache: keep it under the app document directory
 * with the capture session id as its stable, discoverable filename. Never the
 * Android-reclaimable cache directory.
 *
 * Writes go straight through on every socket `data` event rather than being
 * buffered. The log's whole value is that it is lossless, and a buffer is a
 * window in which a crash costs sentences that cannot be re-read off the wire.
 */
export function openRawLog(sessionId: number): RawLog {
  rawLogDirectory.create({ idempotent: true, intermediates: true });
  const file = new File(rawLogDirectory, getRawLogFileName(sessionId));
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
