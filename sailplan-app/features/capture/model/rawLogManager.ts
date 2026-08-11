import type { CaptureSession } from './capture';

export interface RawLogFile {
  path: string;
  fileName: string;
  size: number;
  modificationTime: number | null;
}

export function getRawLogFileName(sessionId: number): string {
  return `session-${sessionId}.nmea`;
}

export type RawLogEntry =
  | {
      id: string;
      kind: 'session';
      session: CaptureSession;
      rawLog: RawLogFile | null;
      recordedAt: number;
    }
  | {
      id: string;
      kind: 'unlinked';
      rawLog: RawLogFile;
      recordedAt: number;
    };

/**
 * Joins the database's session records to the files that really exist on disk.
 * A missing file remains a valid session state; an unmatched file remains
 * visible as an unlinked raw log instead of silently escaping storage totals.
 */
export function buildRawLogEntries(
  sessions: CaptureSession[],
  rawLogs: RawLogFile[],
): RawLogEntry[] {
  const rawLogsByPath = new Map(rawLogs.map(rawLog => [rawLog.path, rawLog]));
  const linkedPaths = new Set<string>();

  const sessionEntries: RawLogEntry[] = sessions.map(session => {
    const rawLog = session.rawLogPath
      ? rawLogsByPath.get(session.rawLogPath) ?? null
      : rawLogs.find(file => file.fileName === getRawLogFileName(session.id)) ?? null;

    if (rawLog) linkedPaths.add(rawLog.path);

    return {
      id: `session-${session.id}`,
      kind: 'session',
      session,
      rawLog,
      recordedAt: session.startedAt,
    };
  });

  const unlinkedEntries: RawLogEntry[] = rawLogs
    .filter(rawLog => !linkedPaths.has(rawLog.path))
    .map(rawLog => ({
      id: `unlinked-${rawLog.path}`,
      kind: 'unlinked',
      rawLog,
      recordedAt: rawLog.modificationTime ?? Number.MAX_SAFE_INTEGER,
    }));

  return [...sessionEntries, ...unlinkedEntries].sort(
    (first, second) => first.recordedAt - second.recordedAt,
  );
}

export function getRawLogStorageBytes(rawLogs: RawLogFile[]): number {
  return rawLogs.reduce((total, rawLog) => total + rawLog.size, 0);
}

export function formatRawLogBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
