import { and, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { captureSession } from '~/schema';
import type { CaptureSession } from '../model/capture';
import { hasReviewedData, isCaptureSessionResumable } from '../model/captureResume';
import { getCaptureResumeFacts } from './captureSession';

export function useCaptureResumeOffer(boatProfileId: number, courseId: number) {
  const query = useLiveQuery(
    db.query.captureSession.findMany({
      where: eq(captureSession.boatProfileId, boatProfileId),
      with: { sailedLegs: true },
      orderBy: [desc(captureSession.startedAt)],
    }),
    [boatProfileId],
  );
  const latest = query.data?.[0];
  const data =
    latest &&
    latest.courseId === courseId &&
    isCaptureSessionResumable(latest, {
      hasLaterSession: false,
      hasReviewedData: hasReviewedData(latest.sailedLegs),
    })
      ? latest
      : null;
  return { ...query, data };
}

export async function getResumableCaptureSession(
  sessionId: number,
): Promise<CaptureSession | null> {
  const session = await db.query.captureSession.findFirst({
    where: and(
      eq(captureSession.id, sessionId),
      eq(captureSession.status, 'autoEnded'),
    ),
  });
  if (!session) return null;
  const facts = await getCaptureResumeFacts(session);
  return isCaptureSessionResumable(session, facts) ? session : null;
}
