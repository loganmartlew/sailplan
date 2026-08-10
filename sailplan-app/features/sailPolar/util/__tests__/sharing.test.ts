import { Sail } from '~/features/sail';
import { parsePolarCsvImport } from '../csvImport';
import { createBatchFingerprint } from '../importFingerprint';

const sails: Sail[] = [
  {
    id: 1,
    name: 'A6',
    color: '#ffffff',
    sailArea: null,
    symmetrical: false,
    masthead: false,
    minTws: null,
    maxTws: null,
    boatProfileId: 1,
  },
];

describe('parsePolarCsvImport', () => {
  it('normalises mapped sail names, whitespace, timestamp formats, and numbers', () => {
    const original = parsePolarCsvImport(
      'Timestamp,Sail,TWS,TWA,BoatSpeed,Notes\n2026-06-30T00:00:00.000Z,A6,12.00,135,7.20,First export',
      sails,
    );
    const reExport = parsePolarCsvImport(
      'TIMESTAMP,SAIL,TWS,TWA,BOATSPEED,NOTES\n2026-06-30T12:00:00+12:00,  a6  ,12,135.0,7.2,Changed note',
      sails,
    );

    expect(createBatchFingerprint(reExport.rows)).toBe(
      createBatchFingerprint(original.rows),
    );
  });

  it('keeps rows without a valid timestamp importable', () => {
    const result = parsePolarCsvImport(
      'Timestamp,Sail,TWS,TWA,BoatSpeed,Notes\nnot-a-date,A6,12,135,7.2,',
      sails,
    );

    expect(result.rows).toEqual([
      expect.objectContaining({ timestamp: null, sailId: 1 }),
    ]);
  });
});
