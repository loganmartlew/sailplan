#!/usr/bin/env bash
# THROWAWAY — ticket `13` device spike only.
#
# Session 5 found that both real backgrounded runs (17, 20) go from full 1 Hz
# coverage to total silence — no socket_error, no socket_close, no recovery —
# after several minutes, with no batching or gap evidence upstream. `02`
# predicted this away as harmless WiFi power-save jitter; this polls the
# radio's own state so a death like that can be correlated against what the
# radio was actually doing, instead of inferred from JS-side silence alone.
#
#   ./wifi-watch.sh [interval_seconds] [out_file]
#
# Run this alongside a normal Tier C spike capture (see ../../.tickets/…/13):
# start it right when you background the app, Ctrl-C it after you stop the
# capture, then diff the timestamps against `node spike/report.mjs`'s
# "activity per 30s bucket" row to see what the radio was doing at the cliff.

set -euo pipefail

INTERVAL="${1:-15}"
OUT="${2:-wifi-watch-$(date +%s).log}"

echo "polling dumpsys wifi every ${INTERVAL}s -> $OUT (Ctrl-C to stop)"

while true; do
  {
    echo "=== $(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) ==="
    adb shell dumpsys wifi 2>/dev/null | grep -iE \
      "rssi|link speed|supplicant state|screen|power save|hiperfmode|low.latency|frequency|score|state:|connected" \
      || echo "(dumpsys wifi produced nothing matching)"
  } >>"$OUT"
  sleep "$INTERVAL"
done
