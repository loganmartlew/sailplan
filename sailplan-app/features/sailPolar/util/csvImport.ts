import type { Sail } from '~/features/sail';
import type { MatchedPolarImportRow } from './importFingerprint';

function parseCsvRow(raw: string): string[] {
  return raw.split(',');
}

function parseFiniteNumber(raw: string): number | null {
  const value = raw.trim();
  if (value.length === 0) return null;

  // parseFloat, not Number: a trailing unit ("12kn", "8.1 kts") has always been
  // read as the leading number, and tightening that here would silently drop
  // rows the import count reports as neither new nor previously imported.
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normaliseTimestamp(raw: string): number | null {
  const value = raw.trim();
  if (value.length === 0) return null;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Parses only rows that are valid and map to a sail in the active profile. */
export function parsePolarCsvImport(
  csv: string,
  sails: Sail[],
  limitedSails: boolean = false,
): { rows: MatchedPolarImportRow[]; unmatched: string[] } {
  const sailByName = new Map(
    sails.map(sail => [sail.name.trim().toLocaleLowerCase(), sail]),
  );
  const unmatchedNames = new Set<string>();
  const rows: MatchedPolarImportRow[] = [];

  // The format is positional. The header is intentionally skipped, making its
  // casing irrelevant to both parsing and the subsequent fingerprint.
  for (const line of csv.split('\n').slice(1)) {
    if (line.trim().length === 0) continue;

    const cols = parseCsvRow(line);
    // CSV columns: Timestamp, Sail, TWS, TWA, BoatSpeed, Notes
    if (cols.length < 5) continue;

    const sailName = cols[1].trim();
    const tws = parseFiniteNumber(cols[2]);
    const twa = parseFiniteNumber(cols[3]);
    const speed = parseFiniteNumber(cols[4]);

    if (tws === null || twa === null || speed === null) continue;

    const matchedSail = sailByName.get(sailName.toLocaleLowerCase());
    if (!matchedSail) {
      if (!limitedSails) unmatchedNames.add(sailName);
      continue;
    }

    rows.push({
      timestamp: normaliseTimestamp(cols[0]),
      sailId: matchedSail.id,
      tws,
      twa,
      speed,
    });
  }

  return { rows, unmatched: [...unmatchedNames] };
}
