/**
 * NMEA 0183 sentence construction — the exact forms ticket `01` established
 * the Zeus 3 puts on the wire, cross-checked field-for-field against the real
 * Navico GoFree capture in `logs/gofree-merrimac.log`.
 *
 * Two rules this module exists to enforce:
 *   - `MWV` is emitted TWICE per second, once `R` and once `T`, same talker,
 *     same formatter. A parser that branches on the sentence type instead of
 *     field 2 will silently mix apparent and true wind. Everything here keeps
 *     that pair together so the bug is always in range.
 *   - Talker ids match the real stream: wind is `WI`, water/compass is `SD`,
 *     GPS is `GP`, transducers are `II`. Do not normalise these — the app must
 *     cope with the same spread the plotter produces.
 */

// XOR of every character between `$` and `*`.
function checksum(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum ^= body.charCodeAt(i);
  return sum.toString(16).toUpperCase().padStart(2, '0');
}

// `fields` are already-formatted strings; empty string means an empty field,
// which is a real and meaningful thing for an instrument to say.
function sentence(talkerAndFormatter, fields) {
  const body = `${talkerAndFormatter},${fields.join(',')}`;
  return `$${body}*${checksum(body)}`;
}

// --- Formatting helpers ------------------------------------------------------

const fx = (n, dp) => (n === null || n === undefined ? '' : n.toFixed(dp));

// Degrees folded into 0–359.9.
const deg360 = n => ((n % 360) + 360) % 360;

// ddmm.mmmm / dddmm.mmmm, the coordinate form every GPS sentence here uses.
function latLon(value, isLat) {
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const m = (abs - d) * 60;
  const dd = String(d).padStart(isLat ? 2 : 3, '0');
  return { value: `${dd}${m.toFixed(4).padStart(7, '0')}`, hemi };
}

const hhmmss = date =>
  String(date.getUTCHours()).padStart(2, '0') +
  String(date.getUTCMinutes()).padStart(2, '0') +
  String(date.getUTCSeconds()).padStart(2, '0') +
  '.' +
  String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, '0');

const ddmmyy = date =>
  String(date.getUTCDate()).padStart(2, '0') +
  String(date.getUTCMonth() + 1).padStart(2, '0') +
  String(date.getUTCFullYear() % 100).padStart(2, '0');

const KN_TO_KMH = 1.852;
const KN_TO_MS = 0.514444;

// --- The sentences -----------------------------------------------------------

// Wind speed and angle. `ref` is 'R' (apparent, bow-relative) or 'T' (true,
// still bow-relative — NOT compass-referenced; that is MWD's job).
// `angle` is 0–359 measured clockwise from the bow: 0–180 = wind from
// starboard, 180–360 = wind from port.
const mwv = (angle, speedKn, ref, status = 'A') =>
  sentence('WIMWV', [fx(deg360(angle), 1), ref, fx(speedKn, 1), 'N', status]);

// True wind direction (compass, the quantity SailPlan calls TWD) + TWS,
// given twice over in two units apiece.
const mwd = (dirTrue, dirMag, speedKn) =>
  sentence('WIMWD', [
    fx(deg360(dirTrue), 1),
    'T',
    fx(deg360(dirMag), 1),
    'M',
    fx(speedKn, 1),
    'N',
    fx(speedKn * KN_TO_MS, 1),
    'M',
  ]);

// Water speed and heading. The real capture populates the heading fields, so
// we do too — but the app must not depend on that (see README).
const vhw = (headTrue, headMag, stwKn) =>
  sentence('SDVHW', [
    fx(headTrue === null ? null : deg360(headTrue), 1),
    'T',
    fx(headMag === null ? null : deg360(headMag), 1),
    'M',
    fx(stwKn, 1),
    'N',
    fx(stwKn * KN_TO_KMH, 1),
    'K',
  ]);

// Magnetic heading + variation. `HDT` is deliberately absent: ticket `01`
// established the Zeus receives it but never transmits it, so true heading
// must be reconstructed from here.
const hdg = (headMag, variationDeg) =>
  sentence('SDHDG', [
    fx(deg360(headMag), 1),
    '',
    '',
    fx(Math.abs(variationDeg), 1),
    variationDeg >= 0 ? 'E' : 'W',
  ]);

// Course and speed over ground.
const vtg = (cogTrue, cogMag, sogKn) =>
  sentence('GPVTG', [
    fx(deg360(cogTrue), 1),
    'T',
    fx(deg360(cogMag), 1),
    'M',
    fx(sogKn, 1),
    'N',
    fx(sogKn * KN_TO_KMH, 1),
    'K',
    'A',
  ]);

const rmc = (date, lat, lon, sogKn, cogTrue, variationDeg) => {
  const la = latLon(lat, true);
  const lo = latLon(lon, false);
  return sentence('GPRMC', [
    hhmmss(date),
    'A',
    la.value,
    la.hemi,
    lo.value,
    lo.hemi,
    fx(sogKn, 1),
    fx(deg360(cogTrue), 1),
    ddmmyy(date),
    fx(Math.abs(variationDeg), 1),
    variationDeg >= 0 ? 'E' : 'W',
    'A',
  ]);
};

const gga = (date, lat, lon) => {
  const la = latLon(lat, true);
  const lo = latLon(lon, false);
  return sentence('GPGGA', [
    hhmmss(date),
    la.value,
    la.hemi,
    lo.value,
    lo.hemi,
    '1',
    '09',
    '1.10',
    '2.0',
    'M',
    '45.0',
    'M',
    '',
    '',
  ]);
};

const gll = (date, lat, lon) => {
  const la = latLon(lat, true);
  const lo = latLon(lon, false);
  return sentence('GPGLL', [
    la.value,
    la.hemi,
    lo.value,
    lo.hemi,
    hhmmss(date),
    'A',
    'A',
  ]);
};

const zda = date =>
  sentence('GPZDA', [
    hhmmss(date),
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCFullYear()),
    '00',
    '00',
  ]);

// Heel is a genuine covariate for boat speed, and it is free in the stream.
// A later ticket may want it; capturing it costs nothing today.
const xdr = (heelDeg, trimDeg) =>
  sentence('IIXDR', [
    'A',
    fx(heelDeg, 1),
    'D',
    'HEEL',
    'A',
    fx(trimDeg, 1),
    'D',
    'TRIM',
    'P',
    '1.016',
    'B',
    'BARO',
  ]);

// --- Timestamped log lines ---------------------------------------------------
//
// Ticket `12` handed `04` and `06` a requirement: the raw log must carry
// per-sentence timestamps, or replay pacing is a guess and tickets `05` and
// `11` lose the timing information they are meant to be tested against. We
// use an NMEA 0183 v4 TAG block, which third-party tools (Signal K) already
// understand, with `c:` in MILLISECONDS — the spec's `c:` is seconds, but
// seconds cannot express a 10 Hz HDG. Readers here accept both (see replay).

function tagBlock(epochMs, source = 'ZEUS') {
  const body = `s:${source},c:${epochMs}`;
  return `\\${body}*${checksum(body)}\\`;
}

const logLine = (epochMs, sentenceText) =>
  `${tagBlock(epochMs)}${sentenceText}`;

module.exports = {
  checksum,
  sentence,
  deg360,
  mwv,
  mwd,
  vhw,
  hdg,
  vtg,
  rmc,
  gga,
  gll,
  zda,
  xdr,
  tagBlock,
  logLine,
};
