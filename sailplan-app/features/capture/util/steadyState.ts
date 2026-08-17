import type { ReplayCaptureSample } from './replayCaptureSession';
import { median } from './statistics';

export const STEADY_MIN_MS = 15_000;
const ROLLING_RADIUS_MS = 1_000;
const MAX_HEADING_DEVIATION = 5;
const MAX_SPEED_DEVIATION_RATIO = 0.05;
const MAX_TWS_DEVIATION = 1;

export type SteadyStretch = {
  startTime: number;
  endTime: number;
  medianBoatSpeed: number;
  medianTws: number;
  medianAbsTwa: number;
};

type CompleteSample = ReplayCaptureSample & {
  tws: number;
  twa: number;
  stw: number;
  hdg: number;
};

type SmoothedSample = {
  timestamp: number;
  tws: number;
  absTwa: number;
  boatSpeed: number;
  heading: number;
};

const signedHeadingDelta = (first: number, second: number) =>
  ((first - second + 540) % 360) - 180;

function circularMean(values: readonly number[]): number {
  const radians = values.map(value => (value * Math.PI) / 180);
  const sine = radians.reduce((sum, value) => sum + Math.sin(value), 0);
  const cosine = radians.reduce((sum, value) => sum + Math.cos(value), 0);
  return ((Math.atan2(sine, cosine) * 180) / Math.PI + 360) % 360;
}

function circularMedian(values: readonly number[]): number {
  return [...values].sort((first, second) => {
    const firstError = values.reduce(
      (sum, value) => sum + Math.abs(signedHeadingDelta(value, first)),
      0,
    );
    const secondError = values.reduce(
      (sum, value) => sum + Math.abs(signedHeadingDelta(value, second)),
      0,
    );
    return firstError - secondError;
  })[0];
}

function rollingMedians(samples: readonly CompleteSample[]): SmoothedSample[] {
  let left = 0;
  let right = 0;
  return samples.map((sample, index) => {
    while (samples[left].timestamp < sample.timestamp - ROLLING_RADIUS_MS) left += 1;
    right = Math.max(right, index);
    while (
      right + 1 < samples.length
      && samples[right + 1].timestamp <= sample.timestamp + ROLLING_RADIUS_MS
    ) right += 1;
    const window = samples.slice(left, right + 1);
    return {
      timestamp: sample.timestamp,
      tws: median(window.map(candidate => candidate.tws)),
      absTwa: median(window.map(candidate => Math.abs(candidate.twa))),
      boatSpeed: median(window.map(candidate => candidate.stw)),
      heading: circularMedian(window.map(candidate => candidate.hdg)),
    };
  });
}

function isSteady(window: readonly SmoothedSample[]): boolean {
  const heading = circularMean(window.map(sample => sample.heading));
  const boatSpeed = window.reduce((sum, sample) => sum + sample.boatSpeed, 0) / window.length;
  const tws = window.reduce((sum, sample) => sum + sample.tws, 0) / window.length;
  return window.every(sample =>
    Math.abs(signedHeadingDelta(sample.heading, heading)) <= MAX_HEADING_DEVIATION
      && Math.abs(sample.boatSpeed - boatSpeed) <= boatSpeed * MAX_SPEED_DEVIATION_RATIO
      && Math.abs(sample.tws - tws) <= MAX_TWS_DEVIATION,
  );
}

export function findSteadyStretches(
  samples: readonly ReplayCaptureSample[],
): SteadyStretch[] {
  const complete = samples
    .filter((sample): sample is CompleteSample =>
      sample.tws !== null
        && sample.twa !== null
        && sample.stw !== null
        && sample.hdg !== null,
    )
    .sort((first, second) => first.timestamp - second.timestamp);
  const groups: CompleteSample[][] = [];
  for (const sample of complete) {
    const group = groups.at(-1);
    if (!group || sample.timestamp - group.at(-1)!.timestamp >= 2_000) groups.push([sample]);
    else group.push(sample);
  }

  return groups.flatMap(group => {
    const smoothed = rollingMedians(group);
    const windows: SteadyStretch[] = [];
    let start = 0;
    for (let end = 0; end < smoothed.length; end += 1) {
      while (smoothed[end].timestamp - smoothed[start].timestamp + 1_000 > STEADY_MIN_MS) {
        start += 1;
      }
      const window = smoothed.slice(start, end + 1);
      if (
        smoothed[end].timestamp - smoothed[start].timestamp + 1_000 === STEADY_MIN_MS
        && isSteady(window)
      ) {
        windows.push({
          startTime: smoothed[start].timestamp,
          endTime: smoothed[end].timestamp + 1_000,
          medianBoatSpeed: median(window.map(sample => sample.boatSpeed)),
          medianTws: median(window.map(sample => sample.tws)),
          medianAbsTwa: median(window.map(sample => sample.absTwa)),
        });
      }
    }

    const merged: SteadyStretch[] = [];
    for (const window of windows) {
      const previous = merged.at(-1);
      if (!previous || window.startTime > previous.endTime) {
        merged.push({ ...window });
      } else {
        const values = smoothed.filter(sample =>
          sample.timestamp >= previous.startTime && sample.timestamp < window.endTime,
        );
        previous.endTime = Math.max(previous.endTime, window.endTime);
        previous.medianBoatSpeed = median(values.map(sample => sample.boatSpeed));
        previous.medianTws = median(values.map(sample => sample.tws));
        previous.medianAbsTwa = median(values.map(sample => sample.absTwa));
      }
    }
    return merged;
  });
}
