import {
  createBatchFingerprint,
  createObservationFingerprint,
  type MatchedPolarImportRow,
} from '../importFingerprint';

function makeRow(
  overrides: Partial<MatchedPolarImportRow> = {},
): MatchedPolarImportRow {
  return {
    timestamp: Date.parse('2026-06-30T00:00:00.000Z'),
    sailId: 4,
    tws: 12,
    twa: 135,
    speed: 7.2,
    ...overrides,
  };
}

describe('polar import fingerprints', () => {
  it('canonicalises batch rows independently of ordering and numeric formatting', () => {
    const first = makeRow({ tws: 12, speed: 7.2 });
    const second = makeRow({ sailId: 9, twa: 95, speed: 6 });

    expect(createBatchFingerprint([first, second])).toBe(
      createBatchFingerprint([
        { ...second, tws: 12.0, speed: 6.0 },
        { ...first, tws: 12.0, speed: 7.2 },
      ]),
    );
  });

  it('uses the matched sail identity, so sail-name casing cannot affect a fingerprint', () => {
    const row = makeRow();

    expect(createBatchFingerprint([row])).toBe(createBatchFingerprint([{ ...row }]));
  });

  it('makes observations with different timestamps distinct', () => {
    expect(createObservationFingerprint(makeRow())).not.toBe(
      createObservationFingerprint(
        makeRow({ timestamp: Date.parse('2026-06-30T00:00:01.000Z') }),
      ),
    );
  });

  it('does not fingerprint an observation without a valid timestamp', () => {
    expect(createObservationFingerprint(makeRow({ timestamp: null }))).toBeNull();
  });
});
