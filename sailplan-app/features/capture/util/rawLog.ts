import { Directory, File, Paths } from 'expo-file-system';

export interface RawLog {
  path: string;
  append: (chunk: string) => void;
  close: () => void;
  remove: () => void;
}

const rawLogDirectory = new Directory(Paths.document, 'capture');

/**
 * Raw NMEA is evidence, not cache: keep it under the app document directory
 * with the capture session id as its stable, discoverable filename.
 */
export function openRawLog(sessionId: number): RawLog {
  rawLogDirectory.create({ idempotent: true, intermediates: true });
  const file = new File(rawLogDirectory, `session-${sessionId}.nmea`);
  file.create({ overwrite: true, intermediates: true });

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
