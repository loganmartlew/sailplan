/**
 * Mode 1 — replay a captured log over TCP at realistic pacing.
 *
 * Seeded with `logs/gofree-merrimac.log`: 274 KB recorded off a Navico GoFree
 * gateway, the same family as the boat's Zeus 3, carrying `$WIMWV` in BOTH `R`
 * and `T` forms plus `$WIMWD`, `$SDVHW`, `$SDHDG`, `$IIXDR`. Real B&G-family
 * wind data, available before ticket `04` ever gets on the water.
 *
 * Pacing comes from per-sentence timestamps when the log has them. The GoFree
 * sample does NOT — this is precisely the gap ticket `12` handed to `04` and
 * `06` — so for that file pacing is an assumption (`--rate`), and any timing
 * conclusion drawn from it is worth nothing. Logs written by this simulator
 * (`--out`) carry TAG blocks and replay at true original wall-clock.
 */

const fs = require('fs');

// `\s:ZEUS,c:1735689600123*4A\$WIMWV,…` — NMEA 0183 v4 TAG block.
const TAG = /^\\([^\\]*)\\(.*)$/;
// `1735689600123 $WIMWV,…` — the simpler prefix form, accepted on read.
const EPOCH_PREFIX = /^(\d{10,13})[ \t](.*)$/;

/**
 * Parses a log into `{ atMs, text, formatter }`, where `atMs` is null when the
 * log carries no time of its own.
 */
function parseLog(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const out = [];
  let base = null;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let atMs = null;
    let text = trimmed;

    const tag = TAG.exec(trimmed);
    if (tag) {
      const c = /(?:^|,)c:(\d+)/.exec(tag[1]);
      if (c) {
        const n = Number(c[1]);
        // `c:` is seconds per the spec, but seconds cannot express a 10 Hz
        // HDG, so we write millis. Accept either: >1e11 is unambiguously ms.
        atMs = n > 1e11 ? n : n * 1000;
      }
      text = tag[2];
    } else {
      const pre = EPOCH_PREFIX.exec(trimmed);
      if (pre) {
        const n = Number(pre[1]);
        atMs = n > 1e11 ? n : n * 1000;
        text = pre[2];
      }
    }

    if (!text.startsWith('$') && !text.startsWith('!')) continue;
    if (atMs !== null && base === null) base = atMs;

    out.push({
      atMs: atMs === null ? null : atMs - base,
      text,
      formatter: text.slice(3, 6),
    });
  }

  return out;
}

/**
 * Builds a source for `createServer`. Emits at the log's own pacing where it
 * has one, otherwise at a fixed `rate` sentences/second.
 */
function replaySource({ path, rate = 10, loop = false, speed = 1, log }) {
  const lines = parseLog(path);
  const timed = lines.length > 0 && lines[0].atMs !== null;

  log(
    `replay: ${lines.length} sentences from ${path} — ` +
      (timed
        ? `own timestamps, ${speed}× speed`
        : `NO timestamps, assuming ${rate}/s (timing conclusions are void)`),
  );

  return channel => {
    let i = 0;
    let timer = null;
    let stopped = false;
    const startedAt = Date.now();

    const tick = () => {
      if (stopped || !channel.alive) return;

      if (i >= lines.length) {
        if (!loop) {
          log('replay: end of log, closing');
          channel.end();
          return;
        }
        i = 0;
      }

      const line = lines[i++];
      channel.send(line.text, line.formatter);

      const next = lines[i];
      let delay;
      if (!next) delay = 1000 / rate;
      else if (timed && next.atMs !== null && line.atMs !== null) {
        // Re-anchor to wall clock each tick so drift cannot accumulate over a
        // three-hour replay.
        delay = Math.max(0, (next.atMs - (Date.now() - startedAt) * speed) / speed);
      } else delay = 1000 / rate;

      timer = setTimeout(tick, delay);
    };

    tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  };
}

module.exports = { replaySource, parseLog };
