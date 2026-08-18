import { distanceMetres } from './reviewMapMarks';

/**
 * Where the boat was against the marks it was given — the evidence leg
 * detection needs when a course is linked.
 *
 * `sailedLegDetection` segments on the shape of the `|TWA|` trace, which cannot
 * see a rounding that does not change the point of sail: on the first real race
 * (ticket 21) two consecutive legs at a similar `|TWA|` merged, and because leg
 * names were positional every later leg was then misfiled. A linked course says
 * where the boat was *supposed* to go, and the track says where it went, so the
 * boundaries can be measured instead of inferred.
 */

export type CourseRoundingMark = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

export type RoundingFix = {
  timestamp: number;
  lat: number | null;
  lon: number | null;
};

export type CourseRounding = {
  courseMarkId: number;
  at: number;
  metres: number;
};

/**
 * How near the boat must come before a mark can claim a boundary. Deliberately
 * generous: a via point entered so the course clears a headland is *passed*,
 * not rounded — 143 m on Saturday's race, and easily 500 m on a course drawn
 * with more margin — and a radius tight enough to reject a pre-start decoy
 * would reject those genuine passes too. Rejecting decoys is the sequence
 * constraint's job; this is only a sanity guard against a stale or
 * mis-georeferenced mark thousands of metres from anywhere the boat sailed.
 */
export const ROUNDING_GUARD_METRES = 750;

/**
 * How far the boat must recede before returning counts as a second pass rather
 * than the same one. Separating passes by leaving the guard radius does not
 * work on a short course, where the boat may never leave it.
 */
export const PASS_SEPARATION_METRES = 200;

type Candidate = { at: number; metres: number };
type PositionedFix = { timestamp: number; latitude: number; longitude: number };

/**
 * Every distinct approach to one mark: each stretch of the track that closes on
 * it and then recedes contributes its nearest point. Local minima, not the one
 * global minimum — a mark passed twice has two, and taking only the nearest
 * would assign the second pass to the first mark.
 */
function passCandidates(
  fixes: readonly PositionedFix[],
  mark: CourseRoundingMark,
  guardMetres: number,
  separationMetres: number,
): Candidate[] {
  const candidates: Candidate[] = [];
  let nearest: Candidate | null = null;
  const keep = (candidate: Candidate | null) => {
    if (candidate !== null && candidate.metres <= guardMetres) candidates.push(candidate);
  };
  for (const fix of fixes) {
    const metres = distanceMetres(fix, mark);
    if (nearest === null || metres < nearest.metres) {
      nearest = { at: fix.timestamp, metres };
    } else if (metres > nearest.metres + separationMetres) {
      keep(nearest);
      nearest = { at: fix.timestamp, metres };
    }
  }
  keep(nearest);
  return candidates;
}

type Cell = { cost: number; fromMark: number; fromCandidate: number };

/**
 * One pass per mark, strictly increasing in time, at the least total distance —
 * a dynamic program over marks × their candidate passes.
 *
 * Greedy assignment fails on a lap course: the first rounding of a mark can be
 * further out than a later pass of the same mark, so taking each mark's closest
 * approach after the previous one hands an early mark a late pass and drags
 * every mark after it forward until one has nothing left to claim. Choosing the
 * whole sequence at once is what makes the monotonic ordering — not the guard
 * radius — the thing that rejects a decoy pass.
 *
 * A mark may also be left unassigned, at a fixed penalty, so a mark that was
 * skipped or missed by a GPS dropout costs one boundary rather than derailing
 * the assignment of every mark after it.
 *
 * Cost is bounded by candidates, not fixes: a pass is a manoeuvre, so even a
 * long session leaves each mark a handful.
 */
function assignRoundings(
  candidatesPerMark: readonly (readonly Candidate[])[],
  skipPenalty: number,
): (number | null)[] {
  const markCount = candidatesPerMark.length;
  const best: Cell[][] = candidatesPerMark.map(candidates =>
    candidates.map(() => ({ cost: Infinity, fromMark: -1, fromCandidate: -1 })),
  );

  for (let markIndex = 0; markIndex < markCount; markIndex += 1) {
    const candidates = candidatesPerMark[markIndex];
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const candidate = candidates[candidateIndex];
      // Every earlier mark skipped, so this is the first assignment.
      let cell: Cell = {
        cost: candidate.metres + skipPenalty * markIndex,
        fromMark: -1,
        fromCandidate: -1,
      };
      for (let priorMark = 0; priorMark < markIndex; priorMark += 1) {
        const skipped = skipPenalty * (markIndex - priorMark - 1);
        for (let prior = 0; prior < candidatesPerMark[priorMark].length; prior += 1) {
          if (candidatesPerMark[priorMark][prior].at >= candidate.at) continue;
          const cost = best[priorMark][prior].cost + skipped + candidate.metres;
          if (cost < cell.cost) cell = { cost, fromMark: priorMark, fromCandidate: prior };
        }
      }
      best[markIndex][candidateIndex] = cell;
    }
  }

  let endMark = -1;
  let endCandidate = -1;
  let endCost = skipPenalty * markCount; // nothing assigned at all
  for (let markIndex = 0; markIndex < markCount; markIndex += 1) {
    for (let candidateIndex = 0; candidateIndex < candidatesPerMark[markIndex].length; candidateIndex += 1) {
      const cost =
        best[markIndex][candidateIndex].cost + skipPenalty * (markCount - markIndex - 1);
      if (cost < endCost) {
        endCost = cost;
        endMark = markIndex;
        endCandidate = candidateIndex;
      }
    }
  }

  const chosen: (number | null)[] = candidatesPerMark.map(() => null);
  let markIndex = endMark;
  let candidateIndex = endCandidate;
  while (markIndex >= 0) {
    chosen[markIndex] = candidateIndex;
    const cell = best[markIndex][candidateIndex];
    markIndex = cell.fromMark;
    candidateIndex = cell.fromCandidate;
  }
  return chosen;
}

/**
 * When the boat rounded each course mark, in mark order — `null` for a mark it
 * never came near. One entry per mark, so the caller can tell a missed mark
 * from a shifted sequence.
 */
export function detectCourseRoundings(
  fixes: readonly RoundingFix[],
  marks: readonly CourseRoundingMark[],
  guardMetres: number = ROUNDING_GUARD_METRES,
): (CourseRounding | null)[] {
  const positioned = fixes
    .filter((fix): fix is RoundingFix & { lat: number; lon: number } =>
      fix.lat !== null && fix.lon !== null,
    )
    .map(fix => ({ timestamp: fix.timestamp, latitude: fix.lat, longitude: fix.lon }))
    .sort((first, second) => first.timestamp - second.timestamp);

  const candidatesPerMark = marks.map(mark =>
    passCandidates(positioned, mark, guardMetres, PASS_SEPARATION_METRES),
  );
  const chosen = assignRoundings(candidatesPerMark, guardMetres);

  return marks.map((mark, index) => {
    const candidateIndex = chosen[index];
    if (candidateIndex === null) return null;
    const candidate = candidatesPerMark[index][candidateIndex];
    return { courseMarkId: mark.id, at: candidate.at, metres: candidate.metres };
  });
}
