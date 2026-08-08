#!/usr/bin/env node
/**
 * Self-test. The simulator is a measuring instrument for four other tickets;
 * an instrument nobody checks is a source of confident wrong answers.
 *
 * Runs in about fifteen seconds against real sockets on ephemeral ports:
 *
 *   node test.js
 */

const assert = require('assert');
const net = require('net');

const S = require('./lib/sentences');
const { createServer } = require('./lib/server');
const { armFaults } = require('./lib/timeline');
const { sailSource } = require('./lib/sail');
const { parseLog } = require('./lib/replay');

const RACE = require('./scripts/race.json');
const quiet = () => {};

let port = 10500;
let failures = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}

/**
 * Serves `faults` over a synthetic sail for `seconds`, and returns both the
 * reassembled sentences and the raw TCP chunks — the chunk boundaries are the
 * whole point of the split/concat tests.
 */
function capture({ faults = [], seconds = 3, course = RACE.course }) {
  return new Promise((resolve, reject) => {
    const p = port++;
    const serverRef = { value: null };

    const source = channel => {
      const cancel = armFaults({ faults, channel, server: serverRef.value, log: quiet });
      const stop = sailSource({ course, seed: 7, log: quiet })(channel);
      return () => {
        cancel();
        stop();
      };
    };

    const srv = createServer({ port: p, host: '127.0.0.1', source, log: quiet });
    serverRef.value = srv;

    srv.listen().then(() => {
      const sock = net.connect(p, '127.0.0.1');
      const chunks = [];
      let buf = '';
      const lines = [];
      let closed = false;

      sock.on('data', d => {
        chunks.push(d.toString('binary'));
        buf += d.toString('binary');
        const parts = buf.split('\r\n');
        buf = parts.pop();
        lines.push(...parts);
      });
      sock.on('close', () => (closed = true));
      sock.on('error', () => (closed = true));

      setTimeout(() => {
        sock.destroy();
        srv.server.close();
        resolve({ lines, chunks, closed });
      }, seconds * 1000);
    }, reject);
  });
}

const parse = line => {
  const star = line.lastIndexOf('*');
  if (star === -1) return null;
  const body = line.slice(1, star);
  return {
    formatter: line.slice(3, 6),
    parts: body.split(','),
    valid: S.checksum(body) === line.slice(star + 1),
  };
};

const signed180 = d => {
  const a = ((d % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
};

// Generated logs are not committed (they are a seed and a second away), so
// the test makes its own.
function ensureRaceLog() {
  const fs = require('fs');
  const p = require('path').join(__dirname, 'logs/race.log');
  if (fs.existsSync(p)) return p;
  require('child_process').execFileSync(
    process.execPath,
    ['nmea-sim.js', 'generate', '--duration', '3000', '--out', 'logs/race.log', '--quiet'],
    { cwd: __dirname },
  );
  return p;
}

async function main() {
  console.log('\nnmea-sim self-test\n');
  ensureRaceLog();

  await test('checksums match the real Navico capture byte for byte', () => {
    // Lifted verbatim from logs/gofree-merrimac.log.
    for (const real of [
      '$WIMWV,297.6,R,5.6,N,A*2A',
      '$WIMWV,297.5,T,5.6,N,A*2F',
      '$WIMWD,125.3,T,124.6,M,5.6,N,2.9,M*56',
      '$SDVHW,182.4,T,181.7,M,0.0,N,0.0,K*42',
      '$SDHDG,181.7,,,0.6,E*3C',
    ]) {
      const star = real.lastIndexOf('*');
      assert.strictEqual(
        S.checksum(real.slice(1, star)),
        real.slice(star + 1),
        `checksum mismatch on ${real}`,
      );
    }
  });

  await test('our own MWV round-trips through the checksum', () => {
    const t = S.mwv(297.5, 5.6, 'T');
    assert.strictEqual(t, '$WIMWV,297.5,T,5.6,N,A*2F');
  });

  await test('MWV is emitted twice a second, once R and once T', async () => {
    const { lines } = await capture({ seconds: 4 });
    const mwv = lines.map(parse).filter(s => s && s.formatter === 'MWV');
    const refs = mwv.map(s => s.parts[2]);
    const r = refs.filter(x => x === 'R').length;
    const t = refs.filter(x => x === 'T').length;
    assert.ok(r >= 3 && t >= 3, `expected >=3 of each, got R=${r} T=${t}`);
    assert.ok(Math.abs(r - t) <= 1, `R and T out of step: R=${r} T=${t}`);
  });

  await test('HDG runs at ~10 Hz while the rest run at ~1 Hz', async () => {
    const { lines } = await capture({ seconds: 4 });
    const count = f => lines.map(parse).filter(s => s && s.formatter === f).length;
    assert.ok(count('HDG') > 5 * count('VHW'), `HDG ${count('HDG')} vs VHW ${count('VHW')}`);
  });

  await test('a split sentence still reassembles into a valid one', async () => {
    const { lines, chunks } = await capture({
      faults: [{ at: 0, do: 'split' }],
      seconds: 3,
    });
    // The chunks must genuinely be fragments — otherwise the test proves
    // nothing about the app's parser.
    const fragments = chunks.filter(c => !c.endsWith('\r\n')).length;
    assert.ok(fragments > 5, `expected fragmented writes, saw ${fragments}`);
    const parsed = lines.map(parse).filter(Boolean);
    assert.ok(parsed.length > 10, 'too few sentences to judge');
    assert.ok(parsed.every(s => s.valid), 'a reassembled sentence failed its checksum');
  });

  await test('concatenated writes carry two sentences in one chunk', async () => {
    const { chunks } = await capture({ faults: [{ at: 0, do: 'concat' }], seconds: 3 });
    const doubled = chunks.filter(c => (c.match(/\$/g) || []).length >= 2).length;
    assert.ok(doubled > 3, `expected multi-sentence chunks, saw ${doubled}`);
  });

  await test('a stale VHW stops while MWV keeps flowing', async () => {
    const { lines } = await capture({
      faults: [{ at: 1, do: 'stale', sentences: ['VHW'], forSec: 2 }],
      seconds: 5,
    });
    const parsed = lines.map(parse).filter(Boolean);
    // Everything before the fault and after it; the gap is what matters.
    const vhw = parsed.filter(s => s.formatter === 'VHW').length;
    const mwv = parsed.filter(s => s.formatter === 'MWV').length;
    assert.ok(vhw >= 2, `VHW should resume, saw ${vhw}`);
    assert.ok(mwv >= 8, `MWV should be unaffected, saw ${mwv}`);
    assert.ok(vhw < 4, `VHW should have gone quiet for ~2s, saw ${vhw} in 5s`);
  });

  await test('corrupt sentences arrive with wrong checksums', async () => {
    const { lines } = await capture({
      faults: [{ at: 0, do: 'corrupt', rate: 0.5 }],
      seconds: 3,
    });
    const parsed = lines.map(parse).filter(Boolean);
    const bad = parsed.filter(s => !s.valid).length;
    assert.ok(bad > 3, `expected corrupted sentences, saw ${bad}/${parsed.length}`);
  });

  await test('empty-field MWV says status V, not zero knots', async () => {
    const { lines } = await capture({
      faults: [{ at: 0, do: 'empty', sentences: ['MWV'] }],
      seconds: 3,
    });
    const mwv = lines.map(parse).filter(s => s && s.formatter === 'MWV');
    assert.ok(mwv.length > 2, 'no MWV seen');
    assert.ok(
      mwv.every(s => s.parts[s.parts.length - 1] === 'V'),
      'empty MWV should carry status V',
    );
    assert.ok(
      mwv.every(s => s.parts.slice(1, -1).every(f => f === '')),
      'empty MWV should have empty fields, not zeroes',
    );
  });

  await test('silence keeps the socket open but stops the bytes', async () => {
    const { lines, closed } = await capture({
      faults: [{ at: 1, do: 'silence', forSec: 5 }],
      seconds: 4,
    });
    assert.strictEqual(closed, false, 'socket should stay open during silence');
    const late = lines.length;
    assert.ok(late > 5, 'should have received the first second of data');
    // Nothing after the fault: the last sentence must be early in the run.
    const { lines: control } = await capture({ seconds: 4 });
    assert.ok(
      lines.length < control.length / 2,
      `silence had little effect: ${lines.length} vs control ${control.length}`,
    );
  });

  await test('dropSocket closes the connection', async () => {
    const { closed } = await capture({ faults: [{ at: 1, do: 'dropSocket' }], seconds: 3 });
    assert.strictEqual(closed, true, 'client should have seen the socket close');
  });

  await test('true wind reduces back out of apparent wind', async () => {
    const { lines } = await capture({ seconds: 5 });
    const bySec = [];
    let cur = {};
    for (const line of lines) {
      const s = parse(line);
      if (!s || !s.valid) continue;
      if (s.formatter === 'MWV' && s.parts[2] === 'R') {
        cur = { awa: signed180(Number(s.parts[1])), aws: Number(s.parts[3]) };
      } else if (s.formatter === 'MWV' && s.parts[2] === 'T') {
        cur.twa = signed180(Number(s.parts[1]));
        cur.tws = Number(s.parts[3]);
      } else if (s.formatter === 'VHW' && cur.twa !== undefined) {
        cur.stw = Number(s.parts[5]);
        bySec.push(cur);
        cur = {};
      }
    }
    assert.ok(bySec.length >= 3, `too few complete samples: ${bySec.length}`);
    for (const s of bySec) {
      const x = s.aws * Math.sin((s.awa * Math.PI) / 180);
      const y = s.aws * Math.cos((s.awa * Math.PI) / 180) - s.stw;
      const twa = (Math.atan2(x, y) * 180) / Math.PI;
      const tws = Math.hypot(x, y);
      assert.ok(Math.abs(signed180(twa - s.twa)) < 1.5, `TWA off by ${(twa - s.twa).toFixed(2)}`);
      assert.ok(Math.abs(tws - s.tws) < 0.3, `TWS off by ${(tws - s.tws).toFixed(2)}`);
    }
  });

  await test('generated logs replay with their own timestamps', () => {
    const lines = parseLog(require('path').join(__dirname, 'logs/race.log'));
    assert.ok(lines.length > 1000, `expected a long log, got ${lines.length}`);
    assert.strictEqual(lines[0].atMs, 0, 'first sentence should be at offset 0');
    const last = lines[lines.length - 1].atMs;
    assert.ok(last > 2_990_000 && last < 3_000_000, `unexpected log span: ${last} ms`);
  });

  await test('the real GoFree capture parses (and is already dirty)', () => {
    const lines = parseLog(require('path').join(__dirname, 'logs/gofree-merrimac.log'));
    assert.ok(lines.length > 6000, `expected ~6300 sentences, got ${lines.length}`);
    assert.strictEqual(lines[0].atMs, null, 'the GoFree sample carries no timestamps');
    const mwv = lines.filter(l => l.formatter === 'MWV');
    assert.ok(mwv.length > 250, `expected ~282 MWV, got ${mwv.length}`);
    // Both wind references really are in there — the whole reason this file
    // is worth having before the boat.
    assert.ok(mwv.some(l => l.text.includes(',R,')), 'no apparent wind in the sample');
    assert.ok(mwv.some(l => l.text.includes(',T,')), 'no true wind in the sample');
    // And a warning to ticket 05: the REAL capture ships malformed sentences.
    const vlw = lines.filter(l => l.formatter === 'VLW');
    assert.ok(
      vlw.every(l => l.text.includes('$SDVLW,$SDVLW')),
      'expected the capture\'s known-malformed VLW lines',
    );
  });

  console.log(
    failures === 0
      ? '\nall passing\n'
      : `\n${failures} failing\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
