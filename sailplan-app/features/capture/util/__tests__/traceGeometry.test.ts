import { buildTracePath } from '../traceGeometry';

const box = { startTime: 0, endTime: 100_000, width: 200, height: 90 };

function samplesAt(stws: readonly (number | null)[]) {
  return stws.map((stw, index) => ({ timestamp: index * 10_000, stw }));
}

describe('buildTracePath', () => {
  it('spans the box on the leg time axis with faster samples drawn higher', () => {
    const { d } = buildTracePath(samplesAt([5, 7, 5]), box);
    const points = [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)]
      .map(([, x, y]) => ({ x: Number(x), y: Number(y) }));

    expect(points).toHaveLength(3);
    expect(points[0].x).toBe(0);
    expect(points[2].x).toBe(40);
    expect(points[1].y).toBeLessThan(points[0].y);
    expect(points.every(point => point.y >= 0 && point.y <= box.height)).toBe(true);
  });

  it('lifts the pen where speed is missing, so a dropout is not drawn as sailing', () => {
    const { d } = buildTracePath(samplesAt([5, null, 6]), box);

    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).not.toContain('L');
  });

  it('scales a slow leg against a floor rather than amplifying it', () => {
    expect(buildTracePath(samplesAt([0.5, 1]), box).topSpeed)
      .toBe(buildTracePath(samplesAt([2, 3]), box).topSpeed);
  });

  it('ignores samples outside the leg and survives having none', () => {
    expect(buildTracePath([{ timestamp: 500_000, stw: 6 }], box).d).toBe('');
    expect(buildTracePath([], box).d).toBe('');
  });

  it('thins a sample-dense leg down to what the pixels can show', () => {
    const dense = Array.from({ length: 5_000 }, (_, index) => ({
      timestamp: index * 20,
      stw: 6,
    }));

    expect(buildTracePath(dense, box).d.match(/[ML]/g)!.length)
      .toBeLessThanOrEqual(box.width * 2);
  });
});
