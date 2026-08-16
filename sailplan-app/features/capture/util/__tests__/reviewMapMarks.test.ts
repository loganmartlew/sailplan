import { selectReviewMapFrame, selectReviewMapMarks } from '../reviewMapMarks';

const marks = [
  { id: 11, order: 0, name: 'Start', latitude: -36.8, longitude: 174.7 },
  { id: 12, order: 1, name: 'Windward', latitude: -36.79, longitude: 174.71 },
  { id: 13, order: 2, name: 'Leeward', latitude: -36.81, longitude: 174.69 },
];

describe('selectReviewMapMarks', () => {
  it('shows the from and to marks for the focused sailed leg', () => {
    expect(selectReviewMapMarks('leg', marks, 12).map(mark => mark.name))
      .toEqual(['Start', 'Windward']);
  });

  it('wraps to the previous ordered mark for a leg ending at the first mark', () => {
    expect(selectReviewMapMarks('leg', marks, 11).map(mark => mark.name))
      .toEqual(['Leeward', 'Start']);
  });

  it('shows every ordered mark for whole-course focus', () => {
    expect(selectReviewMapMarks('course', marks, 12)).toEqual(marks);
  });

  it('shows no marks when the sailed leg is not linked to a course mark', () => {
    expect(selectReviewMapMarks('leg', marks, null)).toEqual([]);
  });
});

describe('selectReviewMapFrame', () => {
  it('keeps the recorded GPS track authoritative when course marks are far away', () => {
    const track = [
      { latitude: -36.8, longitude: 174.7 },
      { latitude: -36.79, longitude: 174.71 },
    ];
    const distantMarks = [
      { latitude: 51.5, longitude: -0.1 },
      { latitude: 51.51, longitude: -0.11 },
    ];

    expect(selectReviewMapFrame(track, distantMarks)).toEqual(track);
  });

  it('falls back to course marks when no continuous GPS track exists', () => {
    const markCoordinates = marks.map(mark => ({
      latitude: mark.latitude,
      longitude: mark.longitude,
    }));

    expect(selectReviewMapFrame([], markCoordinates)).toEqual(markCoordinates);
  });

  it('includes nearby course marks so their labels stay inside the viewport', () => {
    const track = [
      { latitude: -36.8, longitude: 174.7 },
      { latitude: -36.79, longitude: 174.71 },
    ];
    const nearbyMark = { latitude: -36.788, longitude: 174.712 };

    expect(selectReviewMapFrame(track, [nearbyMark])).toEqual([...track, nearbyMark]);
  });
});
