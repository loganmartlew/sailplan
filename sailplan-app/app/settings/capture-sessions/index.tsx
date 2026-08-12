import { useBoatProfile } from '~/features/boatProfile';
import {
  CaptureSessionList,
  useCaptureInset,
  useCaptureSessionSummaries,
} from '~/features/capture';

export default function CaptureSessionsScreen() {
  const { boatProfile } = useBoatProfile();
  const sessions = useCaptureSessionSummaries(boatProfile?.id ?? null);
  const captureInset = useCaptureInset();

  return (
    <CaptureSessionList
      sessions={sessions.data}
      isLoading={sessions.updatedAt === undefined}
      bottomInset={captureInset}
    />
  );
}
