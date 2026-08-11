import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  getRawLogFiles,
  useCaptureSessionsForRawLogs,
} from '../api/rawLogs';
import {
  buildRawLogEntries,
  getRawLogStorageBytes,
} from '../model/rawLogManager';

export function useRawLogManager() {
  const [rawLogs, setRawLogs] = useState(() => getRawLogFiles());
  const sessionsQuery = useCaptureSessionsForRawLogs();

  const refresh = useCallback(() => {
    setRawLogs(getRawLogFiles());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const sessions = sessionsQuery.data ?? [];
  const isLoading = sessionsQuery.updatedAt === undefined;
  const entries = useMemo(
    () => isLoading ? [] : buildRawLogEntries(sessions, rawLogs),
    [isLoading, rawLogs, sessions],
  );

  return {
    entries,
    isLoading,
    rawLogBytes: getRawLogStorageBytes(rawLogs),
    refresh,
  };
}
