// Hermes has no global `Buffer`, and this module counts raw bytes the same way
// the parser does — see the note in `replayCaptureSession`.
import { Buffer } from 'buffer';
import type { ReplayCaptureInput, TimedNmeaChunk } from './replayCaptureSession';

/**
 * Turns a raw log the app recorded back into a replayable stream.
 *
 * The capture recorder writes the plotter's bytes through untouched — no
 * `\s:…,c:…\` tag block, unlike `nmea-sim`'s logs. So a real log carries no
 * arrival times at all, and replaying it with `assumedSentencePeriodMs` alone
 * stretches a two-hour race over seven hours: leg durations, `MIN_LEG_MS` and
 * the data-gap threshold all then measure the log's line density instead of the
 * clock. The only timing a real log does carry is the GPS clock, so that is
 * what this reconstructs from.
 */

const EPOCH_BEARING = new Set(['RMC', 'ZDA']);
/** A burst of sentences for one GPS second is spread across at most this. */
const BURST_SPAN_MS = 1_000;

function parseTimeOfDayMs(time: string): number | null {
  if (!/^\d{6}(?:\.\d+)?$/.test(time)) return null;
  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(2, 4));
  const seconds = Number(time.slice(4));
  if (hours > 23 || minutes > 59 || seconds >= 60) return null;
  return ((hours * 60 + minutes) * 60 + seconds) * 1_000;
}

/**
 * The epoch a sentence stamps itself with, or null for the great majority that
 * carry no clock. Only date-bearing formatters count: a time-of-day-only
 * sentence cannot place itself on a calendar, and inferring the date from a
 * neighbour would put the whole fixture's wall clock at the mercy of which
 * sentence happened to survive a dropout.
 */
function sentenceEpoch(line: string): number | null {
  const payload = /^\$([^*]+)\*[0-9A-Fa-f]{2}/.exec(line.trim())?.[1];
  if (!payload) return null;
  const fields = payload.split(',');
  const formatter = fields[0].slice(-3);
  if (!EPOCH_BEARING.has(formatter)) return null;
  const timeOfDay = parseTimeOfDayMs(fields[1] ?? '');
  if (timeOfDay === null) return null;
  let year: number;
  let month: number;
  let day: number;
  if (formatter === 'RMC') {
    const date = fields[9] ?? '';
    if (!/^\d{6}$/.test(date)) return null;
    day = Number(date.slice(0, 2));
    month = Number(date.slice(2, 4));
    const shortYear = Number(date.slice(4, 6));
    year = shortYear >= 80 ? 1900 + shortYear : 2000 + shortYear;
  } else {
    day = Number(fields[2]);
    month = Number(fields[3]);
    year = Number(fields[4]);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day) + timeOfDay;
}

/**
 * The `sentences` and `sessionStartWallClock` for replaying a raw log, with
 * arrival times reconstructed from the GPS clock. Sample timestamps then land
 * on real UTC, so a diagnostic can name a leg boundary by the time it happened.
 *
 * A dropout stays a dropout: the GPS clock jumps across it, so the gap survives
 * into the reconstructed times rather than being smoothed away.
 *
 * @throws if the log carries no date-bearing (`RMC`/`ZDA`) sentence, since
 * there is then nothing to anchor the reconstruction to.
 */
export function rawLogReplayInput(
  text: string,
): Pick<ReplayCaptureInput, 'sentences' | 'sessionStartWallClock'> {
  const lines = text.split(/(?<=\n)/).filter(line => line.length > 0);
  const stamped = lines.map(line => ({ line, epoch: sentenceEpoch(line) }));

  // A sentence belongs to the second most recently stamped on the wire. The
  // lines ahead of the first stamp belong to the first second: they arrived
  // just before it, and no earlier clock exists to place them by.
  let previous: number | null = null;
  for (const item of stamped) {
    if (item.epoch === null) item.epoch = previous;
    // The plotter's clock is not guaranteed monotonic across a resync, and a
    // step backwards would make `monotonicElapsedMs` go backwards with it.
    else if (previous !== null) item.epoch = Math.max(previous, item.epoch);
    previous = item.epoch;
  }
  const firstEpoch = stamped.reduce<number | null>(
    (found, item) => found ?? item.epoch,
    null,
  );
  if (firstEpoch === null) {
    throw new Error('Raw log carries no dated GPS clock (no RMC or ZDA sentence)');
  }
  const epochs = stamped.map(item => item.epoch ?? firstEpoch);

  const sentences: TimedNmeaChunk[] = [];
  for (let index = 0; index < stamped.length; index += 1) {
    const epoch = epochs[index];
    if (index === 0 || epoch !== epochs[index - 1]) {
      // Spread the burst evenly over the second it belongs to. Capped, so the
      // far side of a dropout does not smear its sentences across the gap.
      let end = index;
      while (end < stamped.length && epochs[end] === epoch) end += 1;
      const next = epochs[end] ?? epoch + BURST_SPAN_MS;
      const span = Math.min(next - epoch, BURST_SPAN_MS);
      for (let position = index; position < end; position += 1) {
        sentences.push({
          chunk: stamped[position].line,
          monotonicElapsedMs:
            epoch - firstEpoch + Math.round((span * (position - index)) / (end - index)),
        });
      }
    }
  }
  // Offsets index into the log file itself, so a diagnostic can point at the
  // byte a sample came from the way the on-device recorder does.
  let rawOffset = 0;
  for (const sentence of sentences) {
    sentence.rawOffset = rawOffset;
    rawOffset += Buffer.byteLength(sentence.chunk as string);
  }

  return { sentences, sessionStartWallClock: firstEpoch };
}
