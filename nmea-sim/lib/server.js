/**
 * The TCP server and the fault layer that sits between a source of sentences
 * and the socket.
 *
 * The fault layer is deliberately NOT a third mode. It is a filter both
 * sources (replay, sail) pass through, because the interesting questions —
 * "does the parser reassemble a split sentence?", "does the app notice VHW has
 * gone stale while MWV keeps flowing?" — are just as worth asking of a real
 * capture as of a synthetic one.
 *
 * Everything here is stdlib `net`. No dependencies, by design: this runs on a
 * laptop next to a phone on a hotspot with no internet.
 */

const net = require('net');

// Every fault this layer can inject. The names are the `do:` verbs in a
// script's `faults` array — see README, and the failure-mode table in
// research/12.
const DEFAULT_FAULTS = () => ({
  silent: false, // emit nothing, socket stays open (app-level staleness)
  staleFormatters: new Set(), // these sentence types stop; others keep flowing
  rateDivisor: new Map(), // formatter -> emit 1 in N
  corruptRate: 0, // fraction of sentences given a wrong checksum
  truncateRate: 0, // fraction cut off mid-sentence
  garbageRate: 0, // fraction preceded by binary junk
  emptyFieldFormatters: new Set(), // emit the "I have no data" form instead
  splitWrites: false, // every sentence written as two TCP writes
  concatWrites: false, // sentences buffered and written two at a time
});

class Channel {
  constructor(socket, opts = {}) {
    this.socket = socket;
    this.faults = DEFAULT_FAULTS();
    this.counts = new Map();
    this.pending = null; // holds a sentence when concatWrites is on
    this.bytes = 0;
    this.log = opts.log || (() => {});
    // Writes are serialised through a promise chain. Without it the delayed
    // tail of a split sentence lands AFTER the sentences that followed it,
    // which is not "a sentence split across two writes" — it is a scrambled
    // stream, a fault nobody asked for and no plotter produces.
    this.chain = Promise.resolve();
  }

  get alive() {
    return this.socket && !this.socket.destroyed && this.socket.writable;
  }

  /**
   * `formatter` is the three-letter sentence type ('MWV', 'VHW', …). It is
   * what the stale/rate faults key off, so a source must always pass it.
   */
  send(text, formatter) {
    if (!this.alive) return;
    const f = this.faults;
    if (f.silent) return;
    if (f.staleFormatters.has(formatter)) return;

    const divisor = f.rateDivisor.get(formatter);
    if (divisor) {
      const n = (this.counts.get(formatter) || 0) + 1;
      this.counts.set(formatter, n);
      if (n % divisor !== 0) return;
    }

    let out = text;
    if (f.emptyFieldFormatters.has(formatter)) out = emptyForm(formatter);
    if (f.corruptRate && Math.random() < f.corruptRate) out = corrupt(out);
    if (f.truncateRate && Math.random() < f.truncateRate) {
      // Truncated: no terminator at all. The parser must not treat the next
      // sentence's `$` as a continuation of this one.
      this.raw(out.slice(0, Math.max(6, Math.floor(out.length * 0.6))));
      return;
    }
    if (f.garbageRate && Math.random() < f.garbageRate) {
      this.raw(randomGarbage());
    }

    const line = out + '\r\n';

    if (f.concatWrites) {
      if (this.pending === null) {
        this.pending = line;
        return;
      }
      this.raw(this.pending + line);
      this.pending = null;
      return;
    }

    if (f.splitWrites) {
      // The single most valuable test in this file. TCP is a byte stream, not
      // a message stream; a parser that assumes one read == one sentence
      // passes every other test here and fails on the water.
      const cut = 1 + Math.floor((line.length - 2) / 2);
      this.raw(line.slice(0, cut));
      this.raw(line.slice(cut), 15);
      return;
    }

    this.raw(line);
  }

  /** `delayMs` holds the chain open first, so ordering is never in doubt. */
  raw(chunk, delayMs = 0) {
    if (!this.alive) return;
    this.chain = this.chain.then(() => {
      if (delayMs) return new Promise(r => setTimeout(r, delayMs)).then(() => this.write(chunk));
      return this.write(chunk);
    });
  }

  write(chunk) {
    if (!this.alive) return;
    this.bytes += Buffer.byteLength(chunk, 'binary');
    this.socket.write(Buffer.from(chunk, 'binary'));
  }

  // Graceful FIN — the client gets a clean `close` event.
  end() {
    if (this.alive) this.socket.end();
  }

  // RST — the abrupt version, which is what a plotter losing power looks like.
  destroy() {
    if (this.socket) this.socket.destroy();
  }
}

// `$WIMWV,,,,,V` — status V, the instrument explicitly saying "no data".
// Must not be parsed as 0 knots from dead ahead.
function emptyForm(formatter) {
  const { sentence } = require('./sentences');
  const talker = formatter === 'MWV' || formatter === 'MWD' ? 'WI' : 'SD';
  const widths = { MWV: 5, MWD: 8, VHW: 8, HDG: 5, VTG: 9 };
  const n = widths[formatter] || 5;
  const fields = new Array(n).fill('');
  fields[n - 1] = 'V';
  return sentence(talker + formatter, fields);
}

function corrupt(text) {
  const star = text.lastIndexOf('*');
  if (star === -1) return text;
  return text.slice(0, star) + '*00';
}

function randomGarbage() {
  const n = 4 + Math.floor(Math.random() * 12);
  const buf = Buffer.alloc(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf.toString('binary');
}

/**
 * A listening server that starts a fresh run of `source` for every client.
 *
 * `source(channel, onStop)` is called once per connection and should start
 * pushing sentences; it returns a `stop()` to be called when the socket dies.
 * The Zeus's own multi-client behaviour is UNCONFIRMED (ticket `01` flagged
 * it); we accept every client so the app is exercised against the permissive
 * case, and `--max-clients 1` reproduces the restrictive one.
 */
function createServer({ port, host = '0.0.0.0', maxClients = 0, source, log }) {
  const channels = new Set();

  const server = net.createServer(socket => {
    const peer = `${socket.remoteAddress}:${socket.remotePort}`;

    if (maxClients && channels.size >= maxClients) {
      log(`refused ${peer} (max-clients ${maxClients})`);
      socket.destroy();
      return;
    }

    socket.setNoDelay(true);
    const channel = new Channel(socket, { log });
    channels.add(channel);
    log(`client connected: ${peer} (${channels.size} open)`);

    const stop = source(channel);

    const cleanup = () => {
      if (!channels.has(channel)) return;
      channels.delete(channel);
      if (typeof stop === 'function') stop();
      log(`client gone: ${peer} — ${channel.bytes} bytes (${channels.size} open)`);
    };
    socket.on('close', cleanup);
    socket.on('error', err => {
      log(`socket error ${peer}: ${err.message}`);
      cleanup();
    });
  });

  return {
    server,
    channels,
    listen: () =>
      new Promise(resolve => server.listen(port, host, () => resolve())),
    // Plotter reboot: drop every client, stop listening, come back later.
    reboot: afterSec => {
      log(`plotter reboot: dropping ${channels.size} client(s), down ${afterSec}s`);
      for (const c of channels) c.destroy();
      channels.clear();
      server.close(() => {
        setTimeout(() => {
          server.listen(port, host, () => log('plotter back up'));
        }, afterSec * 1000);
      });
    },
  };
}

module.exports = { createServer, Channel, DEFAULT_FAULTS };
