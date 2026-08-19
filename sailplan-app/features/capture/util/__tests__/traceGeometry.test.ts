import { buildTraceGeometry, traceCeiling } from '../traceGeometry';

const box = { startTime: 0, endTime: 100_000, width: 200, height: 90 };

function samplesAt(stws: readonly (number | null)[]) {
  return stws.map((stw, index) => ({ timestamp: index * 10_000, stw }));
}

const pointsOf = (path: string) =>
  [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(([, x, y]) => ({
    x: Number(x),
    y: Number(y),
  }));

describe('traceCeiling', () => {
  it('rises to the next gridline above what was actually sailed', () => {
    expect(traceCeiling(7.8)).toBe(8);
    expect(traceCeiling(8.2)).toBe(10);
  });

  it('leaves an exact gridline alone rather than adding headroom', () => {
    expect(traceCeiling(8)).toBe(8);
  });

  it('floors a becalmed leg rather than amplifying it', () => {
    expect(traceCeiling(0.4)).toBe(2);
    expect(traceCeiling(0)).toBe(2);
  });
});

describe('buildTraceGeometry', () => {
  it('spans the box on the leg time axis with faster samples drawn higher', () => {
    const points = pointsOf(buildTraceGeometry({ samples: samplesAt([5, 7, 5]), box }).path);

    expect(points).toHaveLength(3);
    expect(points[0].x).toBe(0);
    expect(points[2].x).toBe(40);
    expect(points[1].y).toBeLessThan(points[0].y);
    expect(points.every(point => point.y >= 0 && point.y <= box.height)).toBe(true);
  });

  it('draws the observed maximum at the top of the plot only when it is the ceiling', () => {
    const { maxSpeed, ceiling, maxSpeedOffset } = buildTraceGeometry({
      samples: samplesAt([5, 7.8]),
      box,
    });

    expect(maxSpeed).toBe(7.8);
    expect(ceiling).toBe(8);
    expect(maxSpeedOffset).toBeGreaterThan(0);
  });

  it('reports no maximum for a leg that recorded no speed', () => {
    const geometry = buildTraceGeometry({ samples: samplesAt([null, null]), box });

    expect(geometry.maxSpeed).toBeNull();
    expect(geometry.maxSpeedOffset).toBeNull();
    expect(geometry.ceiling).toBe(2);
  });

  it('lifts the pen where speed is missing, so a dropout is not drawn as sailing', () => {
    const { path } = buildTraceGeometry({ samples: samplesAt([5, null, 6]), box });

    expect(path.match(/M/g)).toHaveLength(2);
    expect(path).not.toContain('L');
  });

  it('lights only the samples the steadiness mask accepted', () => {
    const geometry = buildTraceGeometry({
      samples: samplesAt([5, 5, 5, 5]),
      mask: [{ startTime: 10_000, endTime: 30_000 }],
      box,
    });

    expect(pointsOf(geometry.path)).toHaveLength(4);
    expect(pointsOf(geometry.steadyPath).map(point => point.x)).toEqual([20, 40]);
  });

  it('lights nothing when no mask is given, so the plain trace still draws', () => {
    const geometry = buildTraceGeometry({ samples: samplesAt([5, 6]), box });

    expect(geometry.steadyPath).toBe('');
    expect(geometry.path).not.toBe('');
  });

  it('labels the speed axis in gridline steps up to the ceiling', () => {
    const { speedGridlines } = buildTraceGeometry({ samples: samplesAt([7.8]), box });

    expect(speedGridlines.map(line => line.value)).toEqual([0, 2, 4, 6, 8]);
    expect(speedGridlines[0].offset).toBe(box.height);
    expect(speedGridlines.at(-1)!.offset).toBe(0);
  });

  it('spaces time gridlines by the length of the leg', () => {
    const minutesFor = (durationMs: number) =>
      buildTraceGeometry({
        samples: [],
        box: { ...box, endTime: durationMs },
      }).timeGridlines.map(line => line.value);

    expect(minutesFor(5 * 60_000)).toEqual([1, 2, 3, 4]);
    expect(minutesFor(12 * 60_000)).toEqual([2, 4, 6, 8, 10]);
    expect(minutesFor(30 * 60_000)).toEqual([5, 10, 15, 20, 25]);
  });

  it('ignores samples outside the leg and survives having none', () => {
    expect(buildTraceGeometry({ samples: [{ timestamp: 500_000, stw: 6 }], box }).path).toBe('');
    expect(buildTraceGeometry({ samples: [], box }).path).toBe('');
  });

  it('thins a sample-dense leg down to what the pixels can show', () => {
    const dense = Array.from({ length: 5_000 }, (_, index) => ({
      timestamp: index * 20,
      stw: 6,
    }));

    expect(buildTraceGeometry({ samples: dense, box }).path.match(/[ML]/g)!.length)
      .toBeLessThanOrEqual(box.width * 2);
  });
});
