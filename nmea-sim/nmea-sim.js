#!/usr/bin/env node
/**
 * nmea-sim — a B&G Zeus 3 on your desk.
 *
 * Ticket `12` decided to build rather than adopt: nothing off the shelf can
 * inject the faults ticket `11` needs, hold one field stale while another
 * keeps updating (ticket `05`), or hand you the ground truth ticket `07` needs
 * to choose a percentile by measurement instead of taste. Ticket `14` is this.
 *
 * It is the thing that keeps the boat off the critical path.
 *
 *   node nmea-sim.js replay                    # real Navico capture over TCP
 *   node nmea-sim.js sail                      # synthetic race + ground truth
 *   node nmea-sim.js sail --script scripts/nasty.json
 *   node nmea-sim.js generate --duration 3600 --out logs/race.log
 *
 * See README.md. No dependencies — stdlib only, on purpose: this runs on a
 * laptop hosting a WiFi hotspot with no internet.
 */

const fs = require('fs');
const path = require('path');

const { createServer } = require('./lib/server');
const { makeEventLog } = require('./lib/events');
const { armFaults } = require('./lib/timeline');
const { replaySource } = require('./lib/replay');
const { Sail, sailSource, sentencesForTick, TICK_HZ } = require('./lib/sail');
const S = require('./lib/sentences');

const DEFAULT_PORT = 10110; // ticket `01`: the Zeus's own NMEA-over-TCP port
const HERE = __dirname;

// --- Arguments ---------------------------------------------------------------

function parseArgs(argv) {
  // A leading flag means no command was given — `--help` and a bare run are
  // the same thing.
  const opts = {
    command: (argv[0] || '').startsWith('-') ? 'help' : argv[0],
    port: DEFAULT_PORT,
    host: '0.0.0.0',
    script: null,
    log: null,
    rate: 10,
    speed: 1,
    seed: 1234,
    loop: false,
    maxClients: 0,
    out: null,
    events: null,
    duration: 0,
    manifest: null,
    quiet: false,
  };
  const rest = [];

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--port': opts.port = Number(next()); break;
      case '--host': opts.host = next(); break;
      case '--script': opts.script = next(); break;
      case '--rate': opts.rate = Number(next()); break;
      case '--speed': opts.speed = Number(next()); break;
      case '--seed': opts.seed = Number(next()); break;
      case '--loop': opts.loop = true; break;
      case '--max-clients': opts.maxClients = Number(next()); break;
      case '--out': opts.out = next(); break;
      case '--events': opts.events = next(); break;
      case '--manifest': opts.manifest = next(); break;
      case '--duration': opts.duration = Number(next()); break;
      case '--quiet': opts.quiet = true; break;
      case '-h':
      case '--help': opts.command = 'help'; break;
      default:
        if (a.startsWith('-')) fail(`Unknown option ${a}`);
        rest.push(a);
    }
  }

  opts.positional = rest;
  return opts;
}

function fail(msg) {
  console.error(`nmea-sim: ${msg}`);
  process.exit(1);
}

function loadScript(p) {
  const full = path.isAbsolute(p) ? p : path.join(HERE, p);
  if (!fs.existsSync(full)) fail(`script not found: ${full}`);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

// --- Shared plumbing ---------------------------------------------------------

function makeLogger(quiet) {
  if (quiet) return () => {};
  return msg => {
    const t = new Date().toISOString().slice(11, 19);
    console.log(`[${t}] ${msg}`);
  };
}

function announce(log, opts) {
  const os = require('os');
  const addrs = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) addrs.push(`${i.address}:${opts.port}`);
    }
  }
  log(`listening on ${opts.host}:${opts.port}`);
  if (addrs.length) log(`reachable at ${addrs.join('  ')}`);
  // The hotspot address the phone will use, per the rig in README.
  if (addrs.some(a => a.startsWith('10.42.0.1')))
    log('hotspot address 10.42.0.1 is up — point the app here');
}

/**
 * Opens the machine-readable event log for a serving run.
 *
 * `--out` and `--events` answer different questions — the bytes that were sent
 * versus when the connection and fault boundaries happened — but a run that
 * wants one almost always wants the other, so `--out` implies an adjacent
 * `.events.jsonl`. `--events` overrides the location; there is no way to
 * suppress it while keeping `--out`, and no reason to want one.
 */
function openEvents(opts) {
  const chosen =
    opts.events || (opts.out ? `${opts.out.replace(/\.log$/, '')}.events.jsonl` : null);
  if (!chosen) return { emit: () => {}, path: null };
  const full = path.isAbsolute(chosen) ? chosen : path.join(HERE, chosen);
  return { emit: makeEventLog(full), path: full };
}

/** Wraps a source so the script's fault timeline is armed per connection. */
function withFaults(source, faults, log, serverRef, emit) {
  return channel => {
    // Faults are armed BEFORE the source starts: an `at: 0` entry must apply
    // to the very first sentence, and a source's first tick is synchronous.
    const cancel = armFaults({
      faults,
      channel,
      server: serverRef.value,
      log,
      emit,
    });
    const stopSource = source(channel);
    return () => {
      cancel();
      if (typeof stopSource === 'function') stopSource();
    };
  };
}

// --- Commands ----------------------------------------------------------------

async function cmdReplay(opts) {
  const log = makeLogger(opts.quiet);
  const logPath = path.isAbsolute(opts.positional[0] || '')
    ? opts.positional[0]
    : path.join(HERE, opts.positional[0] || 'logs/gofree-merrimac.log');
  if (!fs.existsSync(logPath)) fail(`log not found: ${logPath}`);

  const script = opts.script ? loadScript(opts.script) : {};
  const serverRef = { value: null };
  const events = openEvents(opts);
  events.emit('run-start', {
    command: 'replay',
    log: logPath,
    script: opts.script || null,
    speed: opts.speed,
    rate: opts.rate,
  });

  const source = withFaults(
    replaySource({ path: logPath, rate: opts.rate, loop: opts.loop, speed: opts.speed, log }),
    script.faults || [],
    log,
    serverRef,
    events.emit,
  );

  const srv = createServer({ ...opts, source, log, emit: events.emit });
  serverRef.value = srv;
  await srv.listen();
  announce(log, opts);
  if (events.path) log(`event log: ${events.path}`);
}

async function cmdSail(opts) {
  const log = makeLogger(opts.quiet);
  const script = loadScript(opts.script || 'scripts/race.json');
  if (!script.course) fail('script has no `course`');
  const seed = script.seed ?? opts.seed;

  let out = null;
  if (opts.out) {
    const outPath = path.isAbsolute(opts.out) ? opts.out : path.join(HERE, opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    out = fs.createWriteStream(outPath);
    log(`writing timestamped log to ${outPath}`);
  }

  const serverRef = { value: null };
  const events = openEvents(opts);
  events.emit('run-start', {
    command: 'sail',
    script: opts.script || 'scripts/race.json',
    name: script.name || null,
    seed,
    faults: (script.faults || []).length,
  });

  const source = withFaults(
    sailSource({
      course: script.course,
      seed,
      log,
      onLine: out ? (ms, text) => out.write(S.logLine(ms, text) + '\r\n') : null,
    }),
    script.faults || [],
    log,
    serverRef,
    events.emit,
  );

  const srv = createServer({ ...opts, source, log, emit: events.emit });
  serverRef.value = srv;
  await srv.listen();
  announce(log, opts);
  log(`script: ${script.name || opts.script} — ${(script.faults || []).length} scheduled fault(s)`);
}

/**
 * Headless: no socket, no waiting. Produces the same stream as `sail` straight
 * to a timestamped log plus its ground-truth manifest, as fast as the CPU
 * allows. This is how you get three hours of race in a second, which is what
 * ticket `13`'s background-capture spike and ticket `07`'s derivation study
 * both want.
 */
function cmdGenerate(opts) {
  const log = makeLogger(opts.quiet);
  const script = loadScript(opts.script || 'scripts/race.json');
  const seed = script.seed ?? opts.seed;
  const sail = new Sail({ course: script.course, seed });
  const duration = opts.duration || sail.totalSec;

  const outPath = path.isAbsolute(opts.out || '')
    ? opts.out
    : path.join(HERE, opts.out || `logs/${script.name || 'sail'}.log`);
  const manifestPath = opts.manifest
    ? path.isAbsolute(opts.manifest)
      ? opts.manifest
      : path.join(HERE, opts.manifest)
    : outPath.replace(/\.log$/, '') + '.manifest.json';

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const out = fs.createWriteStream(outPath);

  // Fixed epoch so a regenerated log is byte-for-byte reproducible, matching
  // the convention in `polars/generate-polars.js`.
  const epoch = Date.UTC(2026, 5, 30, 1, 0, 0);
  let bytes = 0;

  for (let tick = 0; tick < duration * TICK_HZ; tick++) {
    const tSec = tick / TICK_HZ;
    const date = new Date(epoch + tSec * 1000);
    const state = sail.step(tSec, 1 / TICK_HZ);
    for (const [, text] of sentencesForTick(state, tick, date, sail.c)) {
      const line = S.logLine(date.getTime(), text) + '\r\n';
      bytes += line.length;
      out.write(line);
    }
  }
  out.end();

  const manifest = {
    name: script.name || 'sail',
    description:
      'Ground truth for a synthetic NMEA capture. `truth` is the 1 Hz record ' +
      'of what the boat was actually doing; `grid` is that reduced to the ' +
      "same 1 kn x 4-degree bins the app's clustered polar grid uses, over " +
      'steady-state samples only. A derivation that recovers `grid.trueSpeed` ' +
      'from the stream is correct; one that does not is measuring noise.',
    seed,
    durationSec: duration,
    course: sail.c,
    fleetSource: '../polars/fleet.js',
    noiseModel: {
      twsKn: '+/-0.3 uniform',
      twaDeg: '+/-2 uniform',
      trim: '20% U(0.82,0.92) poor / 65% U(0.97,1.03) on target / 15% U(1.05,1.15) surfing',
      trimDwellSec: sail.c.trimDwellSec,
      note:
        'Marginal distribution is identical to polars/generate-polars.js ' +
        'sampleNoisy, so the percentile-bias figures in research/12 carry ' +
        'over. Trim is HELD for a dwell rather than redrawn per sample.',
    },
    logFile: path.basename(outPath),
    logBytes: bytes,
    grid: sail.groundTruthGrid(),
    truth: sail.truth,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  log(`wrote ${path.relative(HERE, outPath)} — ${duration}s, ${(bytes / 1024 / 1024).toFixed(2)} MB (${(bytes / duration / 1024).toFixed(2)} kB/s)`);
  log(`wrote ${path.relative(HERE, manifestPath)} — ${manifest.grid.length} truth bins, ${sail.truth.length} samples`);
}

function cmdHelp() {
  console.log(
    fs
      .readFileSync(path.join(HERE, 'README.md'), 'utf8')
      .split('## Usage')[1]
      .split('\n## ')[0]
      .replace(/```/g, '')
      .trim(),
  );
}

// --- Entry -------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  process.on('SIGINT', () => {
    console.log('\nnmea-sim: stopped');
    process.exit(0);
  });

  switch (opts.command) {
    case 'replay': return cmdReplay(opts);
    case 'sail': return cmdSail(opts);
    case 'generate': return cmdGenerate(opts);
    case 'help':
    case undefined: return cmdHelp();
    default: fail(`unknown command "${opts.command}" (replay | sail | generate)`);
  }
}

main().catch(err => fail(err.stack || err.message));
