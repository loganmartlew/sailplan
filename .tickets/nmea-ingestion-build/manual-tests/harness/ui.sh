#!/usr/bin/env bash
#
# ui.sh — drive and read the app by accessibility label.
#
# The capture UI labels its controls (`Record this course`, `Open sail stamp
# picker`, `Stamp <sail>`, `Resume recording`, and the retry state's
# `Retrying plotter connection. Gap …`), so the plan's UI steps can be taken
# by name instead of by screen coordinate. Coordinates rot on every layout
# change; labels are what the ticket actually promises a one-handed user.
#
# Two things this deliberately does not do:
#
# - **It is not a timing instrument.** Each call is a round trip of a hundred
#   milliseconds or more. The retry ladder's 1 s and 2 s rungs and the 5 s loss
#   alert are read from the simulator's event log and the vibrator history, not
#   from how fast this script can poll. See ../GUIDE.md.
# - **It does not judge layout.** `screenshot` collects the evidence; whether
#   the strip hides the final card is a human verdict (T06-1).
#
# Usage:
#   ./ui.sh labels                 list every content-desc on screen
#   ./ui.sh text                   list every visible text node
#   ./ui.sh tap "<label>"          tap the centre of the node with that label
#   ./ui.sh hold "<label>" [ms]    long-press it (default 1500 ms)
#   ./ui.sh brush "<label>"        50 ms touch — T06-3's "must not stop"
#   ./ui.sh find "<label>"         print its bounds, or exit 1 if absent
#   ./ui.sh shot <name>            screenshot into $EVIDENCE
#   ./ui.sh notif                  this app's notifications: title, text, actions
#   ./ui.sh service                is the capture foreground service alive?
#   ./ui.sh vibrations [since]     vibrations from this app (since = "HH:MM:SS")
#
# Label matching is a substring, so `./ui.sh tap Stamp` works when only one
# stamp button is on screen and fails loudly when several are.
#
# Env: PKG, EVIDENCE, ADB_SER — as db.sh.
set -euo pipefail

PKG="${PKG:-com.loganmartlew.sailplan.dev}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

adb_() { adb ${ADB_SER:+-s "$ADB_SER"} "$@"; }

if [[ -z "${EVIDENCE:-}" ]]; then
  commit="$(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || echo nogit)"
  serial="$(adb_ get-serialno 2>/dev/null | tr ':.' '--' || echo nodevice)"
  EVIDENCE="$HERE/evidence/${commit}-${serial}"
fi
mkdir -p "$EVIDENCE"

# A recording is a moving window: the strip repaints TWS/TWA about once a
# second, and `uiautomator dump` refuses with "could not get idle state" if it
# asks during a repaint. It succeeds in the gap between them, so retry rather
# than treat the first refusal as the answer. Without this, every label-driven
# step fails for as long as a recording is running — which is the whole of the
# T06 block.
dump() {
  local out
  for _ in 1 2 3 4 5 6 7 8; do
    out="$(adb_ exec-out uiautomator dump /dev/tty 2>/dev/null || true)"
    if [[ "$out" == *"<hierarchy"* ]]; then echo "$out"; return 0; fi
    sleep 0.7
  done
  echo "ui.sh: uiautomator never reached idle after 8 attempts" >&2
  return 1
}

# Prints "x y" for the centre of the single node whose content-desc contains
# $1. Ambiguity is an error, not a coin toss: a script that silently taps the
# first of three matching sails produces a passing run and a wrong stamp row.
centre_of() {
  local want="$1"
  dump | tr '>' '\n' | grep -F "content-desc=\"" | grep -F "$want" | \
  while IFS= read -r node; do
    [[ "$node" =~ content-desc=\"([^\"]*)\" ]] || continue
    local desc="${BASH_REMATCH[1]}"
    [[ "$desc" == *"$want"* ]] || continue
    [[ "$node" =~ bounds=\"\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]\" ]] || continue
    echo "$(( (BASH_REMATCH[1] + BASH_REMATCH[3]) / 2 )) $(( (BASH_REMATCH[2] + BASH_REMATCH[4]) / 2 )) $desc"
  done
}

resolve() {
  local matches; matches="$(centre_of "$1")"
  local n; n="$(grep -c . <<<"$matches" || true)"
  if [[ -z "$matches" ]]; then
    echo "ui.sh: no node matching \"$1\" — run ./ui.sh labels" >&2; exit 1
  elif [[ "$n" -gt 1 ]]; then
    echo "ui.sh: \"$1\" is ambiguous, matched $n nodes:" >&2
    echo "$matches" >&2; exit 1
  fi
  echo "$matches"
}

case "${1:-}" in
  labels)
    dump | tr '>' '\n' | grep -oP 'content-desc="\K[^"]+' | grep -v '^$' | sort -u
    ;;
  text)
    dump | tr '>' '\n' | grep -oP ' text="\K[^"]+' | grep -v '^$'
    ;;
  find)
    resolve "$2"
    ;;
  tap)
    read -r x y desc <<<"$(resolve "$2")"
    adb_ shell input tap "$x" "$y"
    echo "tapped [$desc] at $x,$y"
    ;;
  hold)
    read -r x y desc <<<"$(resolve "$2")"
    adb_ shell input swipe "$x" "$y" "$x" "$y" "${3:-1500}"
    echo "held [$desc] at $x,$y for ${3:-1500}ms"
    ;;
  brush)
    read -r x y desc <<<"$(resolve "$2")"
    adb_ shell input swipe "$x" "$y" "$x" "$y" 50
    echo "brushed [$desc] at $x,$y for 50ms"
    ;;
  shot)
    out="$EVIDENCE/${2:-shot}-$(date +%H%M%S).png"
    adb_ exec-out screencap -p > "$out"
    echo "$out"
    ;;
  notif)
    # --noredact keeps the live TWS/TWA and sample count readable; without it
    # the text T06-3 checks comes back elided.
    adb_ shell dumpsys notification --noredact | \
      awk -v pkg="$PKG" '/NotificationRecord/{keep = index($0, pkg) > 0} keep'
    ;;
  service)
    adb_ shell dumpsys activity services "$PKG" | \
      grep -E "ServiceRecord|isForeground|foreground=|startForeground" || \
      echo "(no service records — expected when not recording)"
    ;;
  vibrations)
    # Millisecond-stamped and attributed to a package, which is what makes
    # T08-1's 5 s alert / 60 s reminder / recovery buzz machine-checkable.
    adb_ shell dumpsys vibrator_manager | grep -F "$PKG" | \
      { [[ -n "${2:-}" ]] && awk -v s="$2" '$3 >= s' || cat; }
    ;;
  *)
    sed -n '3,36p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
    exit 1
    ;;
esac
