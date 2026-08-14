#!/usr/bin/env bash
#
# db.sh — read the recording device's SQLite database and raw logs.
#
# The test plan's pass criteria are mostly SQL, and every one of those queries
# needs the same three lines of adb incantation first. This is those three
# lines, so an agent running the plan spends its attention on the verdict
# rather than on re-deriving `run-as`.
#
# The dev build is debuggable, so `run-as` reaches the app sandbox without root.
# A pull always takes `-wal` and `-shm` alongside the database: expo-sqlite runs
# in WAL mode, and a copy of the bare `.db` taken mid-recording is missing the
# most recent samples — which are exactly the ones under test.
#
# Usage:
#   ./db.sh pull [label]        pull db (+wal/shm) into $EVIDENCE, echo its path
#   ./db.sh q "<sql>"           pull, then run one query, column-aligned
#   ./db.sh sessions            recent capture sessions, newest first
#   ./db.sh logs                list raw capture logs on the device
#   ./db.sh pull-log <name>     pull one raw log (e.g. session-12.nmea)
#   ./db.sh shell               interactive sqlite3 on a fresh pull
#
# Env:
#   PKG        package under test (default com.loganmartlew.sailplan.dev)
#   EVIDENCE   output directory (default ./evidence/<commit>-<serial>)
#   ADB_SER    adb serial, when more than one device is attached
set -euo pipefail

PKG="${PKG:-com.loganmartlew.sailplan.dev}"
DB_REMOTE="files/SQLite/sailplan.db"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

adb_() { adb ${ADB_SER:+-s "$ADB_SER"} "$@"; }

if [[ -z "${EVIDENCE:-}" ]]; then
  commit="$(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || echo nogit)"
  # Over wireless adb the serial is `ip:port`; keep it filesystem-friendly and
  # keep the two transports pointing at the same evidence directory only when
  # they genuinely are the same run (they are not, so they do not).
  serial="$(adb_ get-serialno 2>/dev/null | tr ':.' '--' || echo nodevice)"
  EVIDENCE="$HERE/evidence/${commit}-${serial}"
fi
mkdir -p "$EVIDENCE"

# Pulls the database and its WAL sidecars. `run-as … cat` rather than
# `adb pull`: the sandbox is not world-readable, and exec-out keeps the bytes
# binary-clean where a shell redirect would corrupt them with CRLF translation.
pull() {
  local label="${1:-}" stamp base
  stamp="$(date +%Y%m%dT%H%M%S)"
  base="$EVIDENCE/db-${stamp}${label:+-$label}"
  adb_ exec-out "run-as $PKG cat $DB_REMOTE" > "$base.db"
  for side in wal shm; do
    if adb_ shell "run-as $PKG test -f $DB_REMOTE-$side" 2>/dev/null; then
      adb_ exec-out "run-as $PKG cat $DB_REMOTE-$side" > "$base.db-$side"
    fi
  done
  echo "$base.db"
}

case "${1:-}" in
  pull)
    pull "${2:-}"
    ;;
  q)
    [[ $# -ge 2 ]] || { echo "db.sh q \"<sql>\"" >&2; exit 1; }
    db="$(pull query)"
    echo "-- $db" >&2
    sqlite3 -header -column "$db" "$2"
    ;;
  sessions)
    db="$(pull sessions)"
    echo "-- $db" >&2
    sqlite3 -header -column "$db" "
      SELECT s.id, s.status, s.startedAt, s.endedAt, s.windFrame,
             (SELECT COUNT(*) FROM captureSample WHERE captureSessionId = s.id) AS samples,
             (SELECT COUNT(*) FROM connectionEvent WHERE captureSessionId = s.id) AS events,
             (SELECT COUNT(*) FROM sailStamp WHERE captureSessionId = s.id) AS stamps
      FROM captureSession s ORDER BY s.id DESC LIMIT 10;"
    ;;
  logs)
    adb_ shell "run-as $PKG ls -la files/capture"
    ;;
  pull-log)
    [[ $# -ge 2 ]] || { echo "db.sh pull-log <name>" >&2; exit 1; }
    adb_ exec-out "run-as $PKG cat files/capture/$2" > "$EVIDENCE/$2"
    echo "$EVIDENCE/$2"
    ;;
  shell)
    db="$(pull shell)"
    echo "-- $db" >&2
    sqlite3 "$db"
    ;;
  *)
    sed -n '3,26p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
    exit 1
    ;;
esac
