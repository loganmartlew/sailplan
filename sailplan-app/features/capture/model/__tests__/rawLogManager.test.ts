import type { CaptureSession } from '../capture';
import {
  buildRawLogEntries,
  type RawLogFile,
} from '../rawLogManager';

function session(
  id: number,
  startedAt: number,
  rawLogPath: string | null,
): CaptureSession {
  return {
    id,
    boatProfileId: 1,
    name: `Session ${id}`,
    courseId: null,
    startedAt,
    endedAt: startedAt + 1_000,
    status: 'ended',
    resumeDismissedAt: null,
    rawLogPath,
    windFrame: null,
    reviewMaterializedAt: null,
    healthCounters: '{}',
    notes: '',
  };
}

function rawLog(fileName: string, modificationTime: number): RawLogFile {
  return {
    path: `file:///logs/${fileName}`,
    fileName,
    size: 1_024,
    modificationTime,
  };
}

describe('buildRawLogEntries', () => {
  it('omits sessions whose raw log is no longer on disk', () => {
    const entries = buildRawLogEntries(
      [session(1, 100, 'file:///logs/session-1.nmea')],
      [],
    );

    expect(entries).toEqual([]);
  });

  it('shows stored logs and unmatched files oldest first', () => {
    const linked = rawLog('session-1.nmea', 999);
    const unlinked = rawLog('leftover.nmea', 50);

    const entries = buildRawLogEntries(
      [session(1, 100, linked.path)],
      [linked, unlinked],
    );

    expect(entries.map(entry => [entry.kind, entry.rawLog.fileName])).toEqual([
      ['unlinked', 'leftover.nmea'],
      ['session', 'session-1.nmea'],
    ]);
  });

  it('links a legacy session by its predictable filename', () => {
    const legacyLog = rawLog('session-2.nmea', 200);

    const entries = buildRawLogEntries(
      [session(2, 100, null)],
      [legacyLog],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'session', rawLog: legacyLog });
  });
});
