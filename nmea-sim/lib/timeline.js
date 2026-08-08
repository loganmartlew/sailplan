/**
 * Scheduled fault injection.
 *
 * A script's `faults` array is a timeline of `{ at, do, … }` entries, offsets
 * in seconds from the moment a client connects. The point of expressing it as
 * a file rather than a set of CLI pokes is reproducibility: the same script is
 * a regression test, so tickets `05`, `07`, `10` and `11` can be argued from
 * evidence instead of from imagination.
 *
 * Every op that takes `forSec` reverts itself; ops without it are one-shots.
 */

const OPS = {
  // Socket open, TCP healthy, no bytes. The app-level staleness case.
  silence: (ctx, e) => window(ctx, e, f => (f.silent = true), f => (f.silent = false)),

  // The one no off-the-shelf tool can do: hold one sentence type while the
  // rest keep flowing. Ticket `05`'s per-field staleness question lives here.
  stale: (ctx, e) =>
    window(
      ctx,
      e,
      f => e.sentences.forEach(s => f.staleFormatters.add(s)),
      f => e.sentences.forEach(s => f.staleFormatters.delete(s)),
    ),

  // The instrument saying "I have no data" (status V) rather than going quiet.
  empty: (ctx, e) =>
    window(
      ctx,
      e,
      f => e.sentences.forEach(s => f.emptyFieldFormatters.add(s)),
      f => e.sentences.forEach(s => f.emptyFieldFormatters.delete(s)),
    ),

  // "Complete enough set" logic stalls here if it assumes a fixed rate.
  rate: (ctx, e) =>
    window(
      ctx,
      e,
      f => e.sentences.forEach(s => f.rateDivisor.set(s, e.divisor)),
      f => e.sentences.forEach(s => f.rateDivisor.delete(s)),
    ),

  corrupt: (ctx, e) =>
    window(ctx, e, f => (f.corruptRate = e.rate ?? 0.05), f => (f.corruptRate = 0)),

  truncate: (ctx, e) =>
    window(ctx, e, f => (f.truncateRate = e.rate ?? 0.05), f => (f.truncateRate = 0)),

  garbage: (ctx, e) =>
    window(ctx, e, f => (f.garbageRate = e.rate ?? 0.05), f => (f.garbageRate = 0)),

  split: (ctx, e) =>
    window(ctx, e, f => (f.splitWrites = true), f => (f.splitWrites = false)),

  concat: (ctx, e) =>
    window(ctx, e, f => (f.concatWrites = true), f => (f.concatWrites = false)),

  // FIN by default, RST with `"reset": true`. The client sees a close event
  // either way — this is the *easy* failure, unlike silence above.
  dropSocket: (ctx, e) => (e.reset ? ctx.channel.destroy() : ctx.channel.end()),

  // Ticket `11` q4: telling "the plotter rebooted" apart from "the phone left
  // the boat". From the socket's point of view they start identically.
  reboot: (ctx, e) => ctx.server.reboot(e.afterSec ?? 30),
};

function window(ctx, entry, apply, revert) {
  apply(ctx.channel.faults);
  ctx.log(`fault: ${entry.do}${entry.forSec ? ` for ${entry.forSec}s` : ''}`);
  if (entry.forSec) {
    ctx.timers.push(
      setTimeout(() => {
        revert(ctx.channel.faults);
        ctx.log(`fault: ${entry.do} cleared`);
      }, entry.forSec * 1000),
    );
  }
}

/**
 * Arms a script's faults against one connected client. Returns a `cancel()`
 * that clears every outstanding timer, so a disconnect does not leave a
 * revert firing into a dead socket.
 */
function armFaults({ faults = [], channel, server, log }) {
  const ctx = { channel, server, log, timers: [] };

  for (const entry of faults) {
    const op = OPS[entry.do];
    if (!op) throw new Error(`Unknown fault op "${entry.do}"`);
    // `at: 0` applies synchronously — a source's first tick runs before any
    // timer fires, and "from the first sentence" has to mean the first one.
    if (!entry.at) op(ctx, entry);
    else ctx.timers.push(setTimeout(() => op(ctx, entry), entry.at * 1000));
  }

  return () => ctx.timers.forEach(clearTimeout);
}

module.exports = { armFaults, OPS };
