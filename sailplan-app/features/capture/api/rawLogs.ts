import { asc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { RawLogFile } from '../model/rawLogManager';
import { getRawLogDirectory } from '../util/rawLog';
import { db } from '~/lib/db';
import { captureSession } from '~/schema';

export function useCaptureSessionsForRawLogs() {
  return useLiveQuery(
    db.query.captureSession.findMany({
      orderBy: [asc(captureSession.startedAt)],
    }),
    [],
  );
}

/** Returns every raw NMEA file on disk, including files no longer linked to a session. */
export function getRawLogFiles(): RawLogFile[] {
  const rawLogDirectory = getRawLogDirectory();
  if (!rawLogDirectory.exists) return [];

  return rawLogDirectory
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .filter(file => file.uri.endsWith('.nmea'))
    .map(file => ({
      path: file.uri,
      fileName: file.uri.split('/').pop() ?? 'raw-log.nmea',
      size: file.size,
      modificationTime: file.modificationTime,
    }));
}

/** Removes only the raw NMEA evidence file; the capture session remains untouched. */
export function removeRawLog(path: string): void {
  const file = new File(path);
  if (file.exists) file.delete();
}

/** Hands the complete, verbatim NMEA log to Android's normal share surface. */
export async function shareRawLog(path: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(path, {
    dialogTitle: 'Export raw NMEA log',
    mimeType: 'text/plain',
  });
}
