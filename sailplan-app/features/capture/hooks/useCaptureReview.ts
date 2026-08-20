import { useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import {
  materializeCaptureReview,
  useSailedLegReview,
} from '../api/captureReview';
import {
  groupSailedLegParts,
  summarizeSailedLegs,
  type SailedLegSummary,
} from '../util/legReview';
import type { ReplayCaptureSample } from '../util/replayCaptureSession';
import { findSteadyStretches, type SteadyStretch } from '../util/steadyState';

/**
 * The session's steadiness mask, computed once and held.
 *
 * It is a synchronous pass over every sample of a multi-hour recording, and
 * both review screens want it — the list to say what each leg holds, the leg
 * screen to light the stretches on the trace. Its only input is the samples, so
 * recomputing it per screen would spend the same second twice; a session that
 * gains samples (a resume) changes their count and recomputes, and one that
 * only has its legs rebuilt (a re-detect) correctly keeps the same mask.
 *
 * One entry: the sailor reviews one session at a time.
 */
let cachedMask: {
  sessionId: number;
  sampleCount: number;
  mask: SteadyStretch[];
} | null = null;

function captureSteadyMask(
  sessionId: number,
  samples: readonly ReplayCaptureSample[],
): SteadyStretch[] {
  if (
    cachedMask?.sessionId === sessionId
    && cachedMask.sampleCount === samples.length
  ) {
    return cachedMask.mask;
  }
  const mask = findSteadyStretches(samples);
  cachedMask = { sessionId, sampleCount: samples.length, mask };
  return mask;
}

export type CaptureReviewState = 'preparing' | 'ready' | 'sessionMissing';

/**
 * Everything both review screens read: the stored legs grouped as the sailor
 * sees them, what each holds, and the session's own facts.
 *
 * Materialisation is idempotent, so both the list and a deep-linked leg can ask
 * for it; whichever arrives first does the work. It is deferred off the entry
 * animation because leg detection and draft attribution run synchronously
 * inside a SQLite transaction, and a multi-hour session is a lot of samples.
 */
export function useCaptureReview(sessionId: number) {
  const { session, legs, samples, courseMarks } = useSailedLegReview(sessionId);
  const [prepared, setPrepared] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);

  useEffect(() => {
    setPrepared(false);
    setSessionMissing(false);
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setSessionMissing(!materializeCaptureReview(sessionId));
      setPrepared(true);
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [sessionId]);

  const loaded =
    prepared
    && legs.updatedAt !== undefined
    && samples.updatedAt !== undefined
    && courseMarks.updatedAt !== undefined;

  const mask = useMemo(
    () => (loaded ? captureSteadyMask(sessionId, samples.data) : []),
    [loaded, sessionId, samples.data],
  );
  const presentations = useMemo(
    () => groupSailedLegParts(legs.data),
    [legs.data],
  );
  const summaries = useMemo(
    () => (loaded
      ? summarizeSailedLegs({ legs: legs.data, mask, samples: samples.data })
      : []),
    [loaded, legs.data, mask, samples.data],
  );

  const state: CaptureReviewState = sessionMissing
    ? 'sessionMissing'
    : loaded ? 'ready' : 'preparing';

  return {
    state,
    session,
    legs,
    samples,
    courseMarks,
    mask,
    presentations,
    summaries,
  };
}

export type { SailedLegSummary };
