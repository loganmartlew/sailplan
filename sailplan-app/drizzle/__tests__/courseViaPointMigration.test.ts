import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Migrations are generated, never hand-edited, and there is no headless SQLite
 * here to apply them — so these assert the invariants ticket 11 depends on
 * over the shipped SQL itself: orphan cleanup lands before anything can
 * reference `courseMark`, the Via Point representation rule is enforced by the
 * database, and `courseMark` keeps its rows (and their identities) through an
 * additive change.
 */
const migration = readFileSync(
  join(__dirname, '..', '0009_absurd_senator_kelly.sql'),
  'utf8',
);

const statements = migration
  .split('--> statement-breakpoint')
  .map(statement => statement.trim());

function indexOfStatementMatching(pattern: RegExp): number {
  return statements.findIndex(statement => pattern.test(statement));
}

describe('migration 0009 — Course Via Points', () => {
  test('clears orphaned Course Marks before creating the Via Point table', () => {
    const orphanCleanup = indexOfStatementMatching(
      /^DELETE FROM `courseMark` WHERE NOT EXISTS/i,
    );
    const createViaPoints = indexOfStatementMatching(
      /^CREATE TABLE `courseViaPoint`/i,
    );

    expect(orphanCleanup).toBeGreaterThanOrEqual(0);
    expect(createViaPoints).toBeGreaterThan(orphanCleanup);
  });

  test('enforces exactly one Via Point representation in the database', () => {
    const createViaPoints = statements.find(statement =>
      /^CREATE TABLE `courseViaPoint`/i.test(statement),
    );

    expect(createViaPoints).toContain('courseViaPoint_representation_check');
    expect(createViaPoints).toMatch(
      /"markId" is not null and "courseViaPoint"\."name" is null/i,
    );
    expect(createViaPoints).toMatch(
      /"markId" is null and "courseViaPoint"\."name" is not null/i,
    );
    expect(createViaPoints).toMatch(
      /FOREIGN KEY \(`legStartCourseMarkId`\) REFERENCES `courseMark`/i,
    );
  });

  test('adds Course Mark notes without rebuilding the table', () => {
    expect(migration).toContain('ALTER TABLE `courseMark` ADD `note` text');
    // A rebuild would reassign `courseMark.id`, breaking Leg identity and
    // every Via Point that points at it.
    expect(migration).not.toMatch(/DROP TABLE `courseMark`/i);
    expect(migration).not.toMatch(/__new_courseMark/i);
  });

  test('does not turn foreign keys on itself — the app does that after migrating', () => {
    expect(migration).not.toMatch(/PRAGMA\s+foreign_keys/i);
  });
});
