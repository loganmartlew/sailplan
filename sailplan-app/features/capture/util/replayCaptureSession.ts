export type WindFrame =
  | 'water'
  | 'ground'
  | 'instrument-corrected'
  | 'unknown';

export interface CaptureHealth {
  overLengthLines: number;
  rejects: Record<string, number>;
  stale: Record<string, number>;
}

export interface ReplayCaptureSample {
  timestamp: number;
  gpsTime: number | null;
  tws: number | null;
  twa: number | null;
  twd: number | null;
  stw: number | null;
  sog: number | null;
  cog: number | null;
  hdg: number | null;
  variation: number | null;
  awa: number | null;
  aws: number | null;
  heel: number | null;
  trim: number | null;
  lat: number | null;
  lon: number | null;
  rawOffset: number | null;
}

export interface TimedNmeaChunk {
  chunk: string | Uint8Array;
  monotonicElapsedMs: number;
  rawOffset?: number;
}

export type ReplayCaptureInput = {
  sentences: readonly (string | TimedNmeaChunk)[];
  sessionStartWallClock: number;
  assumedSentencePeriodMs?: number;
  stamps?: readonly unknown[];
  courseMarks?: readonly unknown[];
  spanEdits?: readonly unknown[];
};

export type ReplayCaptureResult = {
  samples: ReplayCaptureSample[];
  health: CaptureHealth;
  windFrame: WindFrame;
};

type FieldName = keyof Omit<ReplayCaptureSample, 'timestamp' | 'rawOffset'>;
type TimedValue = { value: number | null; at: number; ttl: number };
type ParsedUpdate = Partial<Record<FieldName | 'hdgMag', number | null>>;
type ParsedSentence = {
  formatter: string;
  updates: ParsedUpdate;
  anchor: boolean;
  valid: boolean;
  invalidFields: (FieldName | 'hdgMag')[];
};

const COALESCE_MS = 250;
const MIN_SAMPLE_PERIOD_MS = 750;
const ONE_HZ_TTL_MS = 3_000;
const FAST_TTL_MS = 1_000;
const SAMPLE_FIELDS: FieldName[] = [
  'gpsTime', 'tws', 'twa', 'twd', 'stw', 'sog', 'cog', 'hdg',
  'variation', 'awa', 'aws', 'heel', 'trim', 'lat', 'lon',
];
const FORMATTER_FIELDS: Record<string, (FieldName | 'hdgMag')[]> = {
  MWV: ['tws', 'twa', 'awa', 'aws'],
  MWD: ['twd'],
  VHW: ['stw'],
  HDG: ['hdgMag', 'variation'],
  VTG: ['sog', 'cog'],
  RMC: ['gpsTime', 'sog', 'cog', 'variation', 'lat', 'lon'],
  GGA: ['lat', 'lon'],
  XDR: ['heel', 'trim'],
};

const finite = (text: string): number | null => {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};
const inRange = (text: string, min: number, max: number): number | null => {
  const value = finite(text);
  return value !== null && value >= min && value <= max ? value : null;
};
const normal360 = (value: number) => ((value % 360) + 360) % 360;
const signed180 = (value: number) => {
  const angle = normal360(value);
  return angle > 180 ? angle - 360 : angle;
};
const toKnots = (value: number, unit: string) =>
  unit === 'N' ? value : unit === 'K' ? value / 1.852 : value / 0.514444;

function parseCoordinate(valueText: string, hemisphere: string, latitude: boolean): number | null {
  const value = finite(valueText);
  if (value === null || !/^[NSEW]$/.test(hemisphere)) return null;
  if (latitude ? !/[NS]/.test(hemisphere) : !/[EW]/.test(hemisphere)) return null;
  const degrees = Math.floor(value / 100);
  const minutes = value - degrees * 100;
  const max = latitude ? 90 : 180;
  if (degrees > max || minutes < 0 || minutes >= 60) return null;
  const decimal = degrees + minutes / 60;
  return /[SW]/.test(hemisphere) ? -decimal : decimal;
}

function parseGpsTime(time: string, date: string): number | null {
  if (!/^\d{6}(?:\.\d+)?$/.test(time) || !/^\d{6}$/.test(date)) return null;
  const day = Number(date.slice(0, 2));
  const month = Number(date.slice(2, 4));
  const shortYear = Number(date.slice(4, 6));
  const year = shortYear >= 80 ? 1900 + shortYear : 2000 + shortYear;
  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(2, 4));
  const seconds = Number(time.slice(4));
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds >= 60) return null;
  return Date.UTC(year, month - 1, day, hours, minutes, Math.floor(seconds), Math.round((seconds % 1) * 1_000));
}

function variation(valueText: string, direction: string): number | null {
  const value = inRange(valueText, 0, 180);
  if (value === null || !/^[EW]$/.test(direction)) return null;
  return direction === 'E' ? value : -value;
}

function parseFields(formatter: string, fields: string[]): ParsedSentence {
  const result: ParsedSentence = { formatter, updates: {}, anchor: false, valid: true, invalidFields: [] };
  const reject = (...names: (FieldName | 'hdgMag')[]) => {
    result.valid = false;
    result.invalidFields.push(...names);
  };

  if (formatter === 'MWV') {
    const names: FieldName[] = fields[1] === 'T' ? ['twa', 'tws'] : ['awa', 'aws'];
    result.anchor = fields[1] === 'T';
    if (fields.length !== 5 || !/^[RT]$/.test(fields[1] ?? '') || fields[4] !== 'A') return reject(...names), result;
    const angle = inRange(fields[0], 0, 360);
    const speed = inRange(fields[2], 0, 200);
    const speedUnitValid = /^[NKM]$/.test(fields[3]);
    if (fields[1] === 'T') {
      if (angle === null || speed === null || !speedUnitValid) return reject(...names), result;
      Object.assign(result.updates, { twa: signed180(angle), tws: toKnots(speed, fields[3]) });
    } else {
      if (angle === null) reject('awa');
      else result.updates.awa = signed180(angle);
      if (speed === null || !speedUnitValid) reject('aws');
      else result.updates.aws = toKnots(speed, fields[3]);
    }
  } else if (formatter === 'MWD') {
    if (fields.length !== 8 || fields[1] !== 'T' || fields[3] !== 'M' || fields[5] !== 'N' || fields[7] !== 'M') return reject('twd'), result;
    const twd = inRange(fields[0], 0, 360);
    const magnetic = inRange(fields[2], 0, 360);
    const tws = inRange(fields[4], 0, 200);
    const metresPerSecond = inRange(fields[6], 0, 110);
    if (twd === null) reject('twd');
    else result.updates.twd = normal360(twd);
    if (magnetic === null || tws === null || metresPerSecond === null) reject();
  } else if (formatter === 'VHW') {
    result.anchor = true;
    if (fields.length !== 8 || fields[1] !== 'T' || fields[3] !== 'M' || fields[5] !== 'N' || fields[7] !== 'K') return reject('stw'), result;
    const stw = inRange(fields[4], 0, 100);
    const trueHeading = fields[0] === '' ? 0 : inRange(fields[0], 0, 360);
    const magneticHeading = fields[2] === '' ? 0 : inRange(fields[2], 0, 360);
    const kilometresPerHour = inRange(fields[6], 0, 185.2);
    if (stw === null || trueHeading === null || magneticHeading === null || kilometresPerHour === null) return reject('stw'), result;
    result.updates.stw = stw;
  } else if (formatter === 'HDG') {
    if (fields.length !== 5) return reject('hdgMag', 'variation'), result;
    const heading = inRange(fields[0], 0, 360);
    if (heading === null) reject('hdgMag');
    else result.updates.hdgMag = heading;
    if ((fields[1] !== '' || fields[2] !== '') && (inRange(fields[1], 0, 180) === null || !/^[EW]$/.test(fields[2]))) reject();
    if (fields[3] !== '' || fields[4] !== '') {
      const parsedVariation = variation(fields[3], fields[4]);
      if (parsedVariation === null) reject('variation');
      else result.updates.variation = parsedVariation;
    }
  } else if (formatter === 'VTG') {
    if (fields.length !== 9 || fields[1] !== 'T' || fields[5] !== 'N' || (fields[8] && fields[8] !== 'A')) return reject('cog', 'sog'), result;
    const cog = inRange(fields[0], 0, 360);
    const sog = inRange(fields[4], 0, 200);
    const magneticCog = fields[2] === '' ? 0 : inRange(fields[2], 0, 360);
    const kilometresPerHour = inRange(fields[6], 0, 370.4);
    if (cog === null || magneticCog === null) reject('cog');
    else result.updates.cog = normal360(cog);
    if (sog === null || kilometresPerHour === null) reject('sog');
    else result.updates.sog = sog;
  } else if (formatter === 'RMC') {
    if ((fields.length !== 12 && fields.length !== 11) || fields[1] !== 'A') return reject(...FORMATTER_FIELDS.RMC), result;
    const lat = parseCoordinate(fields[2], fields[3], true);
    const lon = parseCoordinate(fields[4], fields[5], false);
    const sog = inRange(fields[6], 0, 200);
    const cog = inRange(fields[7], 0, 360);
    const gpsTime = parseGpsTime(fields[0], fields[8]);
    if (lat === null) reject('lat');
    else result.updates.lat = lat;
    if (lon === null) reject('lon');
    else result.updates.lon = lon;
    if (sog === null) reject('sog');
    else result.updates.sog = sog;
    if (cog === null) reject('cog');
    else result.updates.cog = normal360(cog);
    if (gpsTime === null) reject('gpsTime');
    else result.updates.gpsTime = gpsTime;
    if (fields[9] !== '' || fields[10] !== '') {
      const parsedVariation = variation(fields[9], fields[10]);
      if (parsedVariation === null) reject('variation');
      else result.updates.variation = parsedVariation;
    }
  } else if (formatter === 'GGA') {
    if (fields.length !== 14 || fields[5] === '0') return reject('lat', 'lon'), result;
    const lat = parseCoordinate(fields[1], fields[2], true);
    const lon = parseCoordinate(fields[3], fields[4], false);
    if (inRange(fields[5], 1, 8) === null) return reject('lat', 'lon'), result;
    if (lat === null) reject('lat');
    else result.updates.lat = lat;
    if (lon === null) reject('lon');
    else result.updates.lon = lon;
  } else if (formatter === 'XDR') {
    if (fields.length === 0) return reject('heel', 'trim'), result;
    // Navico's genuine stream prepends a malformed temperature group, so find
    // the named transducers instead of trusting every preceding group to align.
    for (let index = 3; index < fields.length; index += 1) {
      const name = fields[index]?.toUpperCase();
      if (name !== 'HEEL' && name !== 'TRIM') continue;
      const field = name.toLowerCase() as 'heel' | 'trim';
      const value = fields[index - 3] === 'A' && fields[index - 1] === 'D' ? inRange(fields[index - 2], -180, 180) : null;
      if (value === null) reject(field);
      else result.updates[field] = value;
    }
  } else if (formatter === 'VLW') {
    // The formatter is not stored, but validating its standard four-field
    // shape makes the real Navico stream's malformed evidence visible.
    if (fields.length !== 4 || finite(fields[0]) === null || fields[1] !== 'N' || finite(fields[2]) === null || fields[3] !== 'N') reject();
  }
  return result;
}

function checksumParts(line: string): { formatter: string; fields: string[] } | null {
  const match = /^[$!]([^*]+)\*([0-9A-Fa-f]{2})/.exec(line);
  if (!match) return null;
  let sum = 0;
  for (let index = 0; index < match[1].length; index += 1) sum ^= match[1].charCodeAt(index);
  if (sum !== Number.parseInt(match[2], 16)) return null;
  const parts = match[1].split(',');
  return { formatter: parts[0].slice(-3), fields: parts.slice(1) };
}

function formatterOf(line: string): string {
  const start = line.search(/[$!]/);
  return start >= 0 && line.length >= start + 6 ? line.slice(start + 3, start + 6) : 'UNKNOWN';
}

function tagPayload(line: string): string {
  const tagged = /^\\[^\\]*\\(.*)$/.exec(line.trim());
  return tagged?.[1] ?? line.trim();
}

function tagEpoch(line: string): number | null {
  const match = /^\\([^\\]*)\\/.exec(line.trim());
  const clock = match ? /(?:^|,)c:(\d+)/.exec(match[1]) : null;
  if (!clock) return null;
  const value = Number(clock[1]);
  return value > 1e11 ? value : value * 1_000;
}

export type CaptureStreamParser = {
  pushChunk: (input: TimedNmeaChunk) => ReplayCaptureSample[];
  finish: () => ReplayCaptureSample[];
  health: CaptureHealth;
  samples: ReplayCaptureSample[];
  readonly hasValidAnchor: boolean;
};

export function createCaptureStreamParser(sessionStartWallClock: number): CaptureStreamParser {
  const health: CaptureHealth = { overLengthLines: 0, rejects: {}, stale: {} };
  const state = new Map<FieldName | 'hdgMag', TimedValue>();
  const samples: ReplayCaptureSample[] = [];
  let buffered = '';
  let bufferedAt = 0;
  let bufferedOffset = 0;
  let nextRawOffset = 0;
  let pending: { at: number; rawOffset: number | null; corruptWind: boolean } | null = null;
  let lastEmittedAt = -Infinity;
  let hasValidAnchor = false;

  const countReject = (formatter: string) => {
    health.rejects[formatter] = (health.rejects[formatter] ?? 0) + 1;
  };
  const read = (field: FieldName | 'hdgMag', at: number) => {
    const timed = state.get(field);
    if (!timed || timed.value === null) return null;
    if (at - timed.at <= timed.ttl) return timed.value;
    if (field !== 'hdgMag') health.stale[field] = (health.stale[field] ?? 0) + 1;
    return null;
  };
  const isStale = (field: FieldName | 'hdgMag', at: number) => {
    const timed = state.get(field);
    return Boolean(timed && timed.value !== null && at - timed.at > timed.ttl);
  };
  const flush = () => {
    if (!pending) return [];
    const open = pending;
    pending = null;
    if (open.corruptWind) return [];
    const at = open.at;
    const variationValue = read('variation', at);
    const magneticHeading = read('hdgMag', at);
    const sample = Object.fromEntries(SAMPLE_FIELDS.map(field => [field, read(field, at)])) as unknown as ReplayCaptureSample;
    sample.timestamp = sessionStartWallClock + at;
    sample.rawOffset = open.rawOffset;
    sample.variation = variationValue;
    sample.hdg = variationValue === null || magneticHeading === null ? null : normal360(magneticHeading + variationValue);
    if (sample.hdg === null && (isStale('hdgMag', at) || isStale('variation', at))) {
      health.stale.hdg = (health.stale.hdg ?? 0) + 1;
    }
    samples.push(sample);
    lastEmittedAt = at;
    return [sample];
  };

  const consumeLine = (rawLine: string, at: number, rawOffset: number | null) => {
    const emitted: ReplayCaptureSample[] = [];
    if (pending && at - pending.at > COALESCE_MS) emitted.push(...flush());
    const rawPayload = /^\\[^\\]*\\(.*)$/.exec(rawLine)?.[1] ?? rawLine;
    if (rawPayload.length > 82) health.overLengthLines += 1;
    const line = tagPayload(rawLine);
    if (!line) return emitted;
    const checked = checksumParts(line);
    if (!checked) {
      const formatter = formatterOf(line);
      countReject(formatter);
      if (pending && formatter === 'MWV' && /,T(?:,|\*)/.test(line)) pending.corruptWind = true;
      return emitted;
    }
    const parsed = parseFields(checked.formatter, checked.fields);
    if (!parsed.valid) {
      countReject(parsed.formatter);
      const ttl = parsed.formatter === 'HDG' || parsed.formatter === 'GGA' ? FAST_TTL_MS : ONE_HZ_TTL_MS;
      for (const field of parsed.invalidFields) state.set(field, { value: null, at, ttl });
      if (pending && parsed.formatter === 'MWV' && checked.fields[1] === 'T') pending.corruptWind = true;
    }
    const ttl = parsed.formatter === 'HDG' || parsed.formatter === 'GGA' ? FAST_TTL_MS : ONE_HZ_TTL_MS;
    for (const [field, value] of Object.entries(parsed.updates)) state.set(field as FieldName | 'hdgMag', { value: value ?? null, at, ttl });
    if (parsed.anchor && parsed.valid) {
      hasValidAnchor = true;
      if (!pending && at - lastEmittedAt >= MIN_SAMPLE_PERIOD_MS) pending = { at, rawOffset, corruptWind: false };
    }
    return emitted;
  };

  return {
    health,
    samples,
    get hasValidAnchor() {
      return hasValidAnchor;
    },
    pushChunk(input) {
      const text = typeof input.chunk === 'string' ? input.chunk : Buffer.from(input.chunk).toString('utf8');
      const startOffset = input.rawOffset ?? nextRawOffset;
      if (!buffered) {
        bufferedAt = input.monotonicElapsedMs;
        bufferedOffset = startOffset;
      }
      buffered += text;
      nextRawOffset = startOffset + Buffer.byteLength(text);
      const emitted: ReplayCaptureSample[] = [];
      let newline: RegExpExecArray | null;
      while ((newline = /\r?\n/.exec(buffered))) {
        const rawLine = buffered.slice(0, newline.index);
        const consumed = newline.index + newline[0].length;
        emitted.push(...consumeLine(rawLine, bufferedAt, bufferedOffset));
        buffered = buffered.slice(consumed);
        bufferedOffset += Buffer.byteLength(rawLine + newline[0]);
        bufferedAt = input.monotonicElapsedMs;
      }
      return emitted;
    },
    finish() {
      const emitted: ReplayCaptureSample[] = [];
      if (buffered.trim()) {
        emitted.push(...consumeLine(buffered, bufferedAt, bufferedOffset));
        buffered = '';
      }
      emitted.push(...flush());
      return emitted;
    },
  };
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (value: number) => (value * 180) / Math.PI;
function derivedTrue(awa: number, aws: number, speed: number, courseOffset = 0) {
  const x = aws * Math.sin(radians(awa)) - speed * Math.sin(radians(courseOffset));
  const y = aws * Math.cos(radians(awa)) - speed * Math.cos(radians(courseOffset));
  return { angle: degrees(Math.atan2(x, y)), speed: Math.hypot(x, y) };
}
const angularError = (first: number, second: number) => Math.abs(signed180(first - second));

export function classifyWindFrame(samples: readonly ReplayCaptureSample[]): WindFrame {
  const comparisons = samples.flatMap(sample => {
    if ([sample.twa, sample.tws, sample.awa, sample.aws, sample.stw, sample.sog, sample.cog, sample.hdg].some(value => value === null)) return [];
    const water = derivedTrue(sample.awa!, sample.aws!, sample.stw!);
    const ground = derivedTrue(sample.awa!, sample.aws!, sample.sog!, signed180(sample.cog! - sample.hdg!));
    const error = (derived: { angle: number; speed: number }) => angularError(derived.angle, sample.twa!) + Math.abs(derived.speed - sample.tws!) * 3;
    return [{
      water: error(water),
      ground: error(ground),
      separation: angularError(water.angle, ground.angle) + Math.abs(water.speed - ground.speed) * 3,
      twa: Math.abs(sample.twa!),
      waterSpeedDelta: sample.tws! - water.speed,
      waterAngleDelta: signed180(sample.twa! - water.angle),
    }];
  });
  if (comparisons.length < 5) return 'unknown';
  const mean = (key: keyof (typeof comparisons)[number]) => comparisons.reduce((sum, value) => sum + value[key], 0) / comparisons.length;
  const water = mean('water');
  const ground = mean('ground');
  if (mean('separation') < 1) return 'unknown';
  if (water < 4 && water + 1 < ground) return 'water';
  if (ground < 4 && ground + 1 < water) return 'ground';
  if (Math.min(water, ground) >= 4 && comparisons.length >= 20) {
    const correlation = (key: 'waterSpeedDelta' | 'waterAngleDelta') => {
      const meanX = mean('twa');
      const meanY = mean(key);
      let numerator = 0;
      let sumX = 0;
      let sumY = 0;
      for (const value of comparisons) {
        const x = value.twa - meanX;
        const y = value[key] - meanY;
        numerator += x * y;
        sumX += x * x;
        sumY += y * y;
      }
      return sumX === 0 || sumY === 0 ? 0 : numerator / Math.sqrt(sumX * sumY);
    };
    if (Math.max(Math.abs(correlation('waterSpeedDelta')), Math.abs(correlation('waterAngleDelta'))) >= 0.4) return 'instrument-corrected';
  }
  return 'unknown';
}

export function replayCaptureSession(input: ReplayCaptureInput): ReplayCaptureResult {
  const parser = createCaptureStreamParser(input.sessionStartWallClock);
  const assumedPeriod = input.assumedSentencePeriodMs ?? 100;
  let inferredAt = 0;
  let tagBase: number | null = null;
  for (const item of input.sentences) {
    if (typeof item !== 'string') {
      parser.pushChunk(item);
      inferredAt = Math.max(inferredAt, item.monotonicElapsedMs + assumedPeriod);
      continue;
    }
    for (const line of item.split(/(?<=\n)/)) {
      if (!line) continue;
      const epoch = tagEpoch(line);
      if (epoch !== null && tagBase === null) tagBase = epoch;
      const at = epoch === null || tagBase === null ? inferredAt : epoch - tagBase;
      parser.pushChunk({ chunk: line.endsWith('\n') ? line : `${line}\r\n`, monotonicElapsedMs: at });
      inferredAt = Math.max(inferredAt + assumedPeriod, at + assumedPeriod);
    }
  }
  parser.finish();
  return { samples: parser.samples, health: parser.health, windFrame: classifyWindFrame(parser.samples) };
}
