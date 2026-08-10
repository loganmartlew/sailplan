#!/usr/bin/env bash
# Generates the CSVs used by manual test checkpoint A (tickets 01/02/10/11).
#
#   ./make-import-test-csvs.sh "A2" [outdir]
#
# The sail name must match a sail on the boat profile under test, exactly as it
# is spelled in the app (matching is case-insensitive, so casing is free).
set -euo pipefail

SAIL="${1:?usage: make-import-test-csvs.sh <sail-name> [outdir]}"
OUT="${2:-./import-test-csvs}"
mkdir -p "$OUT"

SAIL_UPPER="$(printf '%s' "$SAIL" | tr '[:lower:]' '[:upper:]')"
SAIL_LOWER="$(printf '%s' "$SAIL" | tr '[:upper:]' '[:lower:]')"

# base.csv — the first import. Row 6 repeats row 1's values at a later time:
# two observations, not a duplicate. Expect 6 rows imported.
cat > "$OUT/base.csv" <<EOF
Timestamp,Sail,TWS,TWA,BoatSpeed,Notes
2026-08-01T10:00:00.000Z,$SAIL,10,60,6.10,base
2026-08-01T10:01:00.000Z,$SAIL,10,70,6.40,base
2026-08-01T10:02:00.000Z,$SAIL,12,60,6.80,base
2026-08-01T10:03:00.000Z,$SAIL,12,70,7.10,base
2026-08-01T10:04:00.000Z,$SAIL,14,60,7.30,base
2026-08-01T10:05:00.000Z,$SAIL,10,60,6.10,same values as row 1 at a later time
EOF

# reformatted.csv — base.csv after a hostile re-export: header casing, row
# order, padding whitespace, trailing zeroes, sail-name casing, edited notes.
# Nothing that survives parsing has changed. Expect: blocked as a duplicate.
cat > "$OUT/reformatted.csv" <<EOF
TIMESTAMP,sail,tws,twa,boatspeed,NOTES
2026-08-01T10:05:00.000Z, $SAIL_UPPER , 10.00 , 60.0 , 6.1000 ,re-exported
2026-08-01T10:03:00.000Z,$SAIL_LOWER,12.0,70.00,7.1,re-exported
2026-08-01T10:01:00.000Z, $SAIL ,10.000,70,6.400,re-exported
2026-08-01T10:04:00.000Z,$SAIL, 14 ,60,7.30,re-exported
2026-08-01T10:00:00.000Z,$SAIL,10,60.000,6.10,re-exported
2026-08-01T10:02:00.000Z,$SAIL,12.00,60,6.8000,re-exported
EOF

# partial.csv — three rows already in base.csv plus three genuinely new ones.
# Expect: confirm dialog offering to import 3 and ignore 3.
cat > "$OUT/partial.csv" <<EOF
Timestamp,Sail,TWS,TWA,BoatSpeed,Notes
2026-08-01T10:00:00.000Z,$SAIL,10,60,6.10,already imported
2026-08-01T10:02:00.000Z,$SAIL,12,60,6.80,already imported
2026-08-01T10:04:00.000Z,$SAIL,14,60,7.30,already imported
2026-08-01T11:00:00.000Z,$SAIL,16,60,7.60,new
2026-08-01T11:01:00.000Z,$SAIL,16,70,7.90,new
2026-08-01T11:02:00.000Z,$SAIL,18,60,7.80,new
EOF

# undated.csv — two rows with no timestamp (uncheckable) plus one dated row.
cat > "$OUT/undated.csv" <<EOF
Timestamp,Sail,TWS,TWA,BoatSpeed,Notes
,$SAIL,20,60,8.00,no timestamp
,$SAIL,20,70,8.20,no timestamp
2026-08-01T12:00:00.000Z,$SAIL,20,80,8.30,dated
EOF

# unmatched.csv — one row for a sail this profile does not have.
cat > "$OUT/unmatched.csv" <<EOF
Timestamp,Sail,TWS,TWA,BoatSpeed,Notes
2026-08-01T13:00:00.000Z,Ghost Kite,10,90,5.00,no such sail
2026-08-01T13:01:00.000Z,$SAIL,22,60,8.40,valid
2026-08-01T13:02:00.000Z,$SAIL,22,70,8.60,valid
EOF

# nothing-valid.csv — parses, but no row maps to a sail on this profile.
cat > "$OUT/nothing-valid.csv" <<EOF
Timestamp,Sail,TWS,TWA,BoatSpeed,Notes
2026-08-01T14:00:00.000Z,Ghost Kite,10,90,5.00,no such sail
EOF

echo "Wrote to $OUT:"
ls -1 "$OUT"
