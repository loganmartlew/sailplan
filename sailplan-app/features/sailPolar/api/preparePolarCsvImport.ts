import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import type { Sail } from '~/features/sail';
import { parsePolarCsvImport } from '../util/csvImport';
import { createBatchFingerprint, createObservationFingerprint } from '../util/importFingerprint';
import {
  type CreatePolarImportBatchInput,
  previewPolarImport,
} from './polarImportBatch';

export interface ImportPolarResult {
  inserted: number;
  ignored: number;
  uncheckable: number;
  unmatched: string[];
}

export type PreparedPolarImport =
  | { kind: 'empty'; unmatched: string[] }
  | { kind: 'duplicate'; unmatched: string[]; uncheckable: number }
  | {
      kind: 'ready';
      input: CreatePolarImportBatchInput;
      result: ImportPolarResult;
    };

/**
 * Lets the caller present the duplicate outcome before any rows are written.
 * A selected file is kept in this in-memory result until the user confirms it.
 */
export async function preparePolarCsvImport(
  sails: Sail[],
  boatProfileId: number,
  limitedSails: boolean = false,
): Promise<PreparedPolarImport | null> {
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

  const csv = await new File(asset.uri).text();
  const { rows, unmatched } = parsePolarCsvImport(csv, sails, limitedSails);
  if (rows.length === 0) return { kind: 'empty', unmatched };

  const fileFingerprint = createBatchFingerprint(rows);
  const observationFingerprints = rows.flatMap(row => {
    const fingerprint = createObservationFingerprint(row);
    return fingerprint === null ? [] : [fingerprint];
  });
  const preview = await previewPolarImport(
    boatProfileId,
    fileFingerprint,
    observationFingerprints,
  );
  const uncheckable = rows.length - observationFingerprints.length;

  if (preview.wholeBatchDuplicate) {
    return { kind: 'duplicate', unmatched, uncheckable };
  }

  const newRows = rows.filter(row => {
    const fingerprint = createObservationFingerprint(row);
    return (
      fingerprint === null ||
      !preview.importedObservationFingerprints.has(fingerprint)
    );
  });
  const ignored = rows.length - newRows.length;

  if (newRows.length === 0) {
    return { kind: 'duplicate', unmatched, uncheckable };
  }

  return {
    kind: 'ready',
    input: {
      boatProfileId,
      fileName: asset.name ?? 'polar-import.csv',
      // A partial batch owns only these rows. Its fingerprint must describe its
      // actual contribution so removal of an earlier batch can be re-imported.
      batchFingerprint: createBatchFingerprint(newRows),
      rows: newRows.map(row => ({
        sailId: row.sailId,
        tws: row.tws,
        twa: row.twa,
        speed: row.speed,
        observationFingerprint: createObservationFingerprint(row),
      })),
    },
    result: {
      inserted: newRows.length,
      ignored,
      uncheckable,
      unmatched,
    },
  };
}
