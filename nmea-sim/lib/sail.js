/**
 * Mode 2 — sail a scripted course at a KNOWN polar, and ship the truth.
 *
 * This is the mode that makes ticket `07` decidable rather than guessable.
 * Replay of a real race can never quantify the bias in "take a high percentile
 * of a noisy bin", because nobody knows what the boat's true polar was that
 * day. Here we start from `polars/fleet.js` — the same ground truth the
 * sail-suggestion harness scores against — sail it, corrupt it with the same
 * documented noise model, and write down what the answer was supposed to be.
 * Run the ingestion pipeline over the stream and the question becomes
 * arithmetic: did it recover the polar it was given?
 *
 * It also round-trips the wind maths. The stream carries apparent wind
 * (`MWV,R`) derived from the true wind by vector addition, alongside the true
 * wind (`MWV,T`) the Zeus emits directly. Known TWD/TWS → apparent → NMEA →
 * app → derived TWA/TWS → compare is the only way to test the app's
 * true-wind trig at all, and it is exactly ticket `05`'s question 2.
 *
 * Deliberately a SIBLING of `polars/generate-polars.js`, not an extension of
 * it: that file has one clear job (CSV fixtures for the suggestion harness)
 * and bolting a TCP server onto it would muddy both. They share `fleet.js`.
 */

const {
  mulberry32,
  DOWNWIND_FLEET,
  JIB,
  interpolateBaseSpeed,
} = require('../../polars/fleet');
const S = require('./sentences');

const FLEET = [...DOWNWIND_FLEET, JIB];
const BY_NAME = new Map(FLEET.map(s => [s.name, s]));

const TICK_HZ = 10; // fastest sentence (HDG) sets the tick
const rad = d => (d * Math.PI) / 180;
const degOf = r => (r * 180) / Math.PI;

// Signed −180..180. Positive means TWD is clockwise of heading, i.e. wind from
// the boat's right — starboard tack, matching the app's `getTwa`.
function signed180(deg) {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

// Shortest-arc interpolation between two headings.
function lerpHeading(from, to, u) {
  return S.deg360(from + signed180(to - from) * u);
}

const COURSE_DEFAULTS = {
  twd: 225,
  tws: 12,
  twdOscillationDeg: 8,
  twdOscillationPeriodSec: 300,
  twsOscillationKn: 1.5,
  twsOscillationPeriodSec: 420,
  startLat: -41.2865,
  startLon: 174.7762,
  variationDeg: 21.5, // easterly; Wellington-ish, and non-zero on purpose so
  // a magnetic/true mix-up in the app shows up as 21°, not as rounding
  currentSetDeg: null,
  currentDriftKn: 0,
  transitionSec: 10,
  manoeuvreRecoverSec: 15,
  trimDwellSec: 30,
  repeat: true,
};

/**
 * The physics. One instance per connection (so two clients each get a clean,
 * identically-seeded run rather than a shared half-finished race).
 */
class Sail {
  constructor({ course, seed = 1234 }) {
    this.c = { ...COURSE_DEFAULTS, ...course };
    this.rand = mulberry32(seed);
    this.legs = this.c.legs;
    if (!this.legs || this.legs.length === 0)
      throw new Error('course.legs is required');
    for (const leg of this.legs) {
      if (!BY_NAME.has(leg.sail))
        throw new Error(
          `Unknown sail "${leg.sail}". Fleet: ${[...BY_NAME.keys()].join(', ')}`,
        );
    }
    this.totalSec = this.legs.reduce((a, l) => a + l.durationSec, 0);

    this.lat = this.c.startLat;
    this.lon = this.c.startLon;
    this.trim = { factor: 1, note: 'On Target', untilSec: -1 };
    this.truth = [];
    this.lastTruthSec = -1;
  }

  legAt(tSec) {
    let t = tSec;
    if (this.c.repeat) t = t % this.totalSec;
    let acc = 0;
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      if (t < acc + leg.durationSec)
        return { leg, index: i, intoLeg: t - acc, prev: this.legs[(i - 1 + this.legs.length) % this.legs.length] };
      acc += leg.durationSec;
    }
    const last = this.legs[this.legs.length - 1];
    return { leg: last, index: this.legs.length - 1, intoLeg: last.durationSec, prev: last };
  }

  /**
   * Trim is held, not redrawn every second. The marginal distribution is
   * exactly `sampleNoisy`'s (20 % poor trim, 65 % on target, 15 % surfing), so
   * the percentile-bias arithmetic in research/12 still holds — but a real
   * boat stays badly trimmed for a while, and a steady-state filter that only
   * ever sees i.i.d. noise is being tested against a fiction. Set
   * `trimDwellSec: 0` for the i.i.d. model.
   */
  updateTrim(tSec) {
    if (tSec < this.trim.untilSec) return;
    const roll = this.rand();
    let factor;
    let note;
    if (roll > 0.85) {
      factor = 1.05 + this.rand() * 0.1;
      note = 'Surfing/Planing';
    } else if (roll < 0.2) {
      factor = 0.82 + this.rand() * 0.1;
      note = 'Poor Trim';
    } else {
      factor = 0.97 + this.rand() * 0.06;
      note = 'On Target';
    }
    const dwell = this.c.trimDwellSec
      ? this.c.trimDwellSec * (0.5 + this.rand())
      : 1 / TICK_HZ;
    this.trim = { factor, note, untilSec: tSec + dwell };
  }

  /** Advance to absolute time `tSec` and return the full state. */
  step(tSec, dtSec) {
    const c = this.c;
    const { leg, intoLeg, prev } = this.legAt(tSec);

    // --- Heading, and the manoeuvre around a heading change ---
    const inTransition = intoLeg < c.transitionSec && prev !== leg;
    const headingTrue = inTransition
      ? lerpHeading(prev.headingDeg, leg.headingDeg, intoLeg / c.transitionSec)
      : leg.headingDeg;

    // --- Wind ---
    const twd = S.deg360(
      c.twd +
        c.twdOscillationDeg *
          Math.sin((2 * Math.PI * tSec) / c.twdOscillationPeriodSec),
    );
    const tws = Math.max(
      0.5,
      c.tws +
        c.twsOscillationKn *
          Math.sin((2 * Math.PI * tSec) / c.twsOscillationPeriodSec),
    );

    const twaSigned = signed180(twd - headingTrue);
    const twa = Math.abs(twaSigned);
    const tack = twa === 0 || twa === 180 ? null : twaSigned > 0 ? 'starboard' : 'port';

    // --- Speed: the polar, then what spoils it ---
    const sail = BY_NAME.get(leg.sail);
    const base = interpolateBaseSpeed(tws, sail.baseSpeeds);
    // Outside its band a sail still moves the boat, just badly. Recorded in
    // the manifest so the truth stays exact even off-band.
    const outside =
      twa < sail.twaBand[0]
        ? sail.twaBand[0] - twa
        : twa > sail.twaBand[1]
          ? twa - sail.twaBand[1]
          : 0;
    const bandFactor = Math.max(0.35, 1 - 0.015 * outside);
    const trueSpeed = base * bandFactor;

    // A tack or gybe: heading swings through the wind, speed collapses and
    // takes ~15 s to come back. This is the signal ticket `07`'s steady-state
    // filter exists to reject, so the manifest flags every sample of it.
    const crossesWind =
      prev !== leg &&
      Math.sign(signed180(twd - prev.headingDeg)) !==
        Math.sign(signed180(twd - leg.headingDeg));
    let manoeuvre = 1;
    let manoeuvring = false;
    if (crossesWind || (prev !== leg && Math.abs(signed180(leg.headingDeg - prev.headingDeg)) > 30)) {
      if (inTransition) {
        manoeuvre = 1 - 0.6 * (intoLeg / c.transitionSec);
        manoeuvring = true;
      } else if (intoLeg < c.transitionSec + c.manoeuvreRecoverSec) {
        manoeuvre = 0.4 + 0.6 * ((intoLeg - c.transitionSec) / c.manoeuvreRecoverSec);
        manoeuvring = true;
      }
    }

    this.updateTrim(tSec);
    const stw = Math.max(0, trueSpeed * this.trim.factor * manoeuvre);

    // --- What the instruments actually report ---
    // Same ±0.3 kn / ±2° measurement noise `generate-polars.js` uses.
    const twsMeas = Math.max(0, tws + (this.rand() * 0.6 - 0.3));
    const twaMeasSigned = twaSigned + (this.rand() * 4 - 2);
    const twdMeas = S.deg360(headingTrue + twaMeasSigned);

    // Apparent wind by vector addition — what a real vane sees, and what the
    // app must be able to reduce back to the true wind.
    const awx = twsMeas * Math.sin(rad(twaMeasSigned));
    const awy = twsMeas * Math.cos(rad(twaMeasSigned)) + stw;
    const awa = degOf(Math.atan2(awx, awy));
    const aws = Math.hypot(awx, awy);

    // --- Dead reckoning, so the GPS sentences agree with the log ---
    const vN = stw * Math.cos(rad(headingTrue));
    const vE = stw * Math.sin(rad(headingTrue));
    const cN = c.currentDriftKn * Math.cos(rad(c.currentSetDeg ?? 0));
    const cE = c.currentDriftKn * Math.sin(rad(c.currentSetDeg ?? 0));
    const gN = vN + cN;
    const gE = vE + cE;
    const hours = dtSec / 3600;
    this.lat += (gN * hours) / 60;
    this.lon += (gE * hours) / (60 * Math.cos(rad(this.lat)));
    const sog = Math.hypot(gN, gE);
    const cog = S.deg360(degOf(Math.atan2(gE, gN)));

    // Heel: real, free in the stream, and a genuine covariate for boat speed.
    const heel = tws * Math.sin(rad(twa)) * 0.55 * (tack === 'port' ? -1 : 1);

    const state = {
      tSec,
      headingTrue,
      headingMag: S.deg360(headingTrue - c.variationDeg),
      twd,
      tws,
      twa,
      twaSigned,
      tack,
      sailName: sail.name,
      trueSpeed,
      bandFactor,
      trimFactor: this.trim.factor,
      trimNote: this.trim.note,
      manoeuvring,
      stw,
      sog,
      cog,
      twsMeas,
      twaMeasSigned,
      twdMeas,
      awa,
      aws,
      heel,
      lat: this.lat,
      lon: this.lon,
    };

    // Truth at 1 Hz — the sample rate ticket `01` established for every
    // polar-relevant sentence, so one truth row per sample row.
    const sec = Math.floor(tSec);
    if (sec !== this.lastTruthSec) {
      this.lastTruthSec = sec;
      this.truth.push({
        t: sec,
        sail: sail.name,
        twd: round(twd, 2),
        tws: round(tws, 3),
        twa: round(twa, 2),
        tack,
        headingTrue: round(headingTrue, 2),
        trueSpeed: round(trueSpeed, 3),
        stw: round(stw, 3),
        trimNote: this.trim.note,
        manoeuvring,
      });
    }

    return state;
  }

  /**
   * The file ticket `07`'s end-to-end assertion compares against: per sail,
   * per (1 kn TWS × 4° TWA) bin — the same clustering `buildClusteredPolarGrid`
   * uses — what the boat's speed TRULY was, over steady-state samples only.
   */
  groundTruthGrid() {
    const bins = new Map();
    for (const r of this.truth) {
      if (r.manoeuvring) continue;
      const twsBin = Math.round(r.tws);
      const twaBin = Math.round(r.twa / 4) * 4;
      const key = `${r.sail}|${twsBin}|${twaBin}`;
      const b = bins.get(key) || { sail: r.sail, tws: twsBin, twa: twaBin, n: 0, sum: 0, sumMeasured: 0 };
      b.n += 1;
      b.sum += r.trueSpeed;
      b.sumMeasured += r.stw;
      bins.set(key, b);
    }
    return [...bins.values()]
      .map(b => ({
        sail: b.sail,
        tws: b.tws,
        twa: b.twa,
        samples: b.n,
        trueSpeed: round(b.sum / b.n, 3),
        measuredMeanSpeed: round(b.sumMeasured / b.n, 3),
      }))
      .sort((a, b) => a.sail.localeCompare(b.sail) || a.tws - b.tws || a.twa - b.twa);
  }
}

const round = (n, dp) => Number(n.toFixed(dp));

/** The sentences for one tick, at the rates ticket `01` documented. */
function sentencesForTick(state, tickIndex, date, course) {
  const out = [];
  const at = hz => tickIndex % (TICK_HZ / hz) === 0;

  // HDG at 10 Hz — the only fast sentence, and the reason the tick is 10 Hz.
  out.push(['HDG', S.hdg(state.headingMag, course.variationDeg)]);

  if (at(5)) {
    out.push(['GGA', S.gga(date, state.lat, state.lon)]);
    out.push(['GLL', S.gll(date, state.lat, state.lon)]);
  }

  if (at(1)) {
    // The MWV pair, adjacent, every second. Same talker, same formatter,
    // different field 2. The most plausible parser bug in the feature.
    out.push(['MWV', S.mwv(state.awa, state.aws, 'R')]);
    out.push(['MWV', S.mwv(state.twaMeasSigned, state.twsMeas, 'T')]);
    out.push([
      'MWD',
      S.mwd(state.twdMeas, state.twdMeas - course.variationDeg, state.twsMeas),
    ]);
    out.push(['VHW', S.vhw(state.headingTrue, state.headingMag, state.stw)]);
    out.push([
      'VTG',
      S.vtg(state.cog, state.cog - course.variationDeg, state.sog),
    ]);
    out.push([
      'RMC',
      S.rmc(date, state.lat, state.lon, state.sog, state.cog, course.variationDeg),
    ]);
    out.push(['ZDA', S.zda(date)]);
    out.push(['XDR', S.xdr(state.heel, 0.5)]);
  }

  return out;
}

/**
 * Builds a source for `createServer`. Also drives the optional `--out` log,
 * which is written with TAG-block timestamps so it replays at true pacing.
 */
function sailSource({ course, seed, log, onLine }) {
  return channel => {
    const sail = new Sail({ course, seed });
    const startWall = Date.now();
    let tick = 0;
    let timer = null;
    let stopped = false;

    log(
      `sail: ${sail.legs.length} legs, ${sail.totalSec}s per lap` +
        `${sail.c.repeat ? ' (repeating)' : ''}, TWD ${sail.c.twd}° TWS ${sail.c.tws} kn, seed ${seed}`,
    );

    const run = () => {
      if (stopped || !channel.alive) return;

      const tSec = tick / TICK_HZ;
      if (!sail.c.repeat && tSec > sail.totalSec) {
        log('sail: course complete, closing');
        channel.end();
        return;
      }

      const date = new Date(startWall + tSec * 1000);
      const state = sail.step(tSec, 1 / TICK_HZ);
      for (const [formatter, text] of sentencesForTick(state, tick, date, sail.c)) {
        channel.send(text, formatter);
        if (onLine) onLine(date.getTime(), text);
      }

      tick += 1;
      // Re-anchor to wall clock: setTimeout drift over three hours is minutes.
      const nextAt = startWall + (tick / TICK_HZ) * 1000;
      timer = setTimeout(run, Math.max(0, nextAt - Date.now()));
    };

    run();

    return () => {
      stopped = true;
      clearTimeout(timer);
      channel.sail = sail;
    };
  };
}

module.exports = { Sail, sailSource, sentencesForTick, FLEET, TICK_HZ };
