import { and, desc, eq, inArray } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import { polarImportBatch, sailPolar } from '~/schema';
import { PolarImportBatch } from '../model/polarImportBatch';

export interface PolarImportRow {
  sailId: number;
  tws: number;
  twa: number;
  speed: number;
  observationFingerprint: string | null;
}

export interface PolarImportPreview {
  wholeBatchDuplicate: boolean;
  importedObservationFingerprints: Set<string>;
}

export interface CreatePolarImportBatchInput {
  boatProfileId: number;
  fileName: string;
  batchFingerprint: string;
  rows: PolarImportRow[];
}

/** Checks only earlier import batches belonging to this boat profile. */
export async function previewPolarImport(
  boatProfileId: number,
  batchFingerprint: string,
  observationFingerprints: string[],
): Promise<PolarImportPreview> {
  const existingBatch = await db
    .select({ id: polarImportBatch.id })
    .from(polarImportBatch)
    .where(
      and(
        eq(polarImportBatch.boatProfileId, boatProfileId),
        eq(polarImportBatch.batchFingerprint, batchFingerprint),
      ),
    )
    .get();

  if (observationFingerprints.length === 0) {
    return {
      wholeBatchDuplicate: existingBatch !== undefined,
      importedObservationFingerprints: new Set(),
    };
  }

  const matchingRows = await db
    .select({ observationFingerprint: sailPolar.observationFingerprint })
    .from(sailPolar)
    .innerJoin(
      polarImportBatch,
      eq(sailPolar.importBatchId, polarImportBatch.id),
    )
    .where(
      and(
        eq(polarImportBatch.boatProfileId, boatProfileId),
        eq(sailPolar.sourceKind, 'import'),
        inArray(sailPolar.observationFingerprint, observationFingerprints),
      ),
    )
    .all();

  return {
    wholeBatchDuplicate: existingBatch !== undefined,
    importedObservationFingerprints: new Set(
      matchingRows.flatMap(row =>
        row.observationFingerprint === null ? [] : [row.observationFingerprint],
      ),
    ),
  };
}

/** Creates the provenance record and its owned rows as one SQLite transaction. */
export async function createPolarImportBatch(
  input: CreatePolarImportBatchInput,
): Promise<{ batch: PolarImportBatch; inserted: number }> {
  if (input.rows.length === 0) {
    throw new Error('Cannot create an empty polar import batch');
  }

  return db.transaction(tx => {
    const batch = tx
      .insert(polarImportBatch)
      .values({
        boatProfileId: input.boatProfileId,
        importedAt: Date.now(),
        fileName: input.fileName,
        batchFingerprint: input.batchFingerprint,
        rowCount: input.rows.length,
      })
      .returning()
      .get();

    tx.insert(sailPolar)
      .values(
        input.rows.map(row => ({
          ...row,
          sourceKind: 'import' as const,
          importBatchId: batch.id,
        })),
      )
      .run();

    return { batch, inserted: input.rows.length };
  });
}

export function usePolarImportBatches(boatProfileId: number) {
  return useLiveQuery(
    db.query.polarImportBatch.findMany({
      where: eq(polarImportBatch.boatProfileId, boatProfileId),
      orderBy: [desc(polarImportBatch.importedAt)],
    }),
    [boatProfileId],
  );
}

/** Removes a batch's contribution without touching manual or captured polars. */
export async function deletePolarImportBatch(batchId: number): Promise<void> {
  db.transaction(tx => {
    tx
      .delete(sailPolar)
      .where(
        and(
          eq(sailPolar.importBatchId, batchId),
          eq(sailPolar.sourceKind, 'import'),
        ),
      )
      .run();
    tx.delete(polarImportBatch).where(eq(polarImportBatch.id, batchId)).run();
  });
}
