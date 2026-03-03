import { File, Paths, Directory } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Sail } from '~/features/sail';
import { importSailPolars } from '../api/createSailPolar';
import { SailPolarInsert } from '../model/sailPolar';

export interface ImportPolarResult {
  inserted: number;
  unmatched: string[];
}

function parseCsvRow(raw: string): string[] {
  return raw.split(',');
}

export async function importPolarsFromCsv(
  sails: Sail[],
  limitedSails: boolean = false,
): Promise<ImportPolarResult | null> {
  const pickerResult = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/comma-separated-values',
      'public.comma-separated-values-text',
    ],
    copyToCacheDirectory: true,
  });

  if (pickerResult.canceled) return null;

  const asset = pickerResult.assets?.[0];
  if (!asset) return null;

  const file = new File(asset.uri);
  const csv = await file.text();

  const lines = csv
    .split('\n')
    .filter((line: string) => line.trim().length > 0);
  // skip header row
  const dataLines = lines.slice(1);

  const sailByName = new Map(sails.map(s => [s.name.toLowerCase(), s]));
  const unmatchedNames = new Set<string>();
  const inserts: SailPolarInsert[] = [];

  for (const line of dataLines) {
    const cols = parseCsvRow(line);
    // CSV columns: Timestamp, Sail, TWS, TWA, BoatSpeed, Notes
    if (cols.length < 5) continue;

    const sailName = cols[1].trim();
    const tws = parseFloat(cols[2]);
    const twa = parseFloat(cols[3]);
    const speed = parseFloat(cols[4]);

    if (isNaN(tws) || isNaN(twa) || isNaN(speed)) continue;

    const matchedSail = sailByName.get(sailName.toLowerCase());
    if (!matchedSail) {
      if (!limitedSails) unmatchedNames.add(sailName);
      continue;
    }

    inserts.push({ sailId: matchedSail.id, tws, twa, speed });
  }

  await importSailPolars(inserts);

  return { inserted: inserts.length, unmatched: [...unmatchedNames] };
}
