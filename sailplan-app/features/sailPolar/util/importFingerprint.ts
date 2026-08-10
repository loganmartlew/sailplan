/** A parsed CSV row after its sail has been matched to the active profile. */
export interface MatchedPolarImportRow {
  /** Unix milliseconds, or null when the CSV timestamp cannot be parsed. */
  timestamp: number | null;
  sailId: number;
  tws: number;
  twa: number;
  speed: number;
}

function canonicalNumber(value: number): string {
  // Number#toString removes insignificant zeroes and normalises -0 to 0.
  return Object.is(value, -0) ? '0' : value.toString();
}

function canonicalRow(row: MatchedPolarImportRow): string {
  return JSON.stringify([
    row.timestamp,
    row.sailId,
    canonicalNumber(row.tws),
    canonicalNumber(row.twa),
    canonicalNumber(row.speed),
  ]);
}

/**
 * Produces an order-independent canonical representation of an effective CSV
 * import. It intentionally contains no raw file formatting or notes.
 */
export function createBatchFingerprint(rows: MatchedPolarImportRow[]): string {
  return JSON.stringify(rows.map(canonicalRow).sort());
}

/**
 * Identifies one timestamped imported observation. Undateable rows are
 * deliberately uncheckable for partial overlap.
 */
export function createObservationFingerprint(
  row: MatchedPolarImportRow,
): string | null {
  return row.timestamp === null ? null : canonicalRow(row);
}
