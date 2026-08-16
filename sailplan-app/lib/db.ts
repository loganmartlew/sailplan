import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from '~/schema';

export const expoDb = openDatabaseSync('sailplan.db', {
  enableChangeListener: true,
});
export const db = drizzle(expoDb, { schema });

/**
 * Enforcement for every `references()` in `schema.ts` (ADR-0001).
 *
 * Deliberately *not* run at module load: migrations must apply with
 * enforcement off, so that 0009 can clear pre-existing orphaned `courseMark`
 * rows first, and so that older table-rebuild migrations (0006 drops and
 * recreates `course`) are not failed by rows that reference the table
 * mid-rebuild. `MigrationGate` calls this once migrations have succeeded, and
 * blocks the app until it has.
 */
export function enableForeignKeys(): void {
  expoDb.execSync('PRAGMA foreign_keys = ON');
}
