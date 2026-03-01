import { getTwa } from '../bearing';

describe('getTwa', () => {
  test('Returns the correct values for 0 TWD', () => {
    const twd = 0;

    expect(getTwa({ twd, bearing: 45 })).toEqual({ angle: 45, tack: 'port' });
    expect(getTwa({ twd, bearing: 90 })).toEqual({ angle: 90, tack: 'port' });
    expect(getTwa({ twd, bearing: 135 })).toEqual({ angle: 135, tack: 'port' });

    expect(getTwa({ twd, bearing: 225 })).toEqual({ angle: 135, tack: 'starboard' });
    expect(getTwa({ twd, bearing: 270 })).toEqual({ angle: 90, tack: 'starboard' });
    expect(getTwa({ twd, bearing: 315 })).toEqual({ angle: 45, tack: 'starboard' });

    expect(getTwa({ twd, bearing: 0 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd, bearing: 180 })).toEqual({ angle: 180, tack: null });
  });
  test('Returns the correct values for 90 TWD', () => {
    const twd = 90;

    expect(getTwa({ twd, bearing: 135 })).toEqual({ angle: 45, tack: 'port' });
    expect(getTwa({ twd, bearing: 180 })).toEqual({ angle: 90, tack: 'port' });
    expect(getTwa({ twd, bearing: 225 })).toEqual({ angle: 135, tack: 'port' });

    expect(getTwa({ twd, bearing: 315 })).toEqual({ angle: 135, tack: 'starboard' });
    expect(getTwa({ twd, bearing: 0 })).toEqual({ angle: 90, tack: 'starboard' });
    expect(getTwa({ twd, bearing: 45 })).toEqual({ angle: 45, tack: 'starboard' });

    expect(getTwa({ twd, bearing: 90 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd, bearing: 270 })).toEqual({ angle: 180, tack: null });
  });
  test('Returns the correct values for 180 TWD', () => {
    const twd = 180;

    expect(getTwa({ twd, bearing: 225 })).toEqual({ angle: 45, tack: 'port' });
    expect(getTwa({ twd, bearing: 270 })).toEqual({ angle: 90, tack: 'port' });
    expect(getTwa({ twd, bearing: 315 })).toEqual({ angle: 135, tack: 'port' });

    expect(getTwa({ twd, bearing: 45 })).toEqual({ angle: 135, tack: 'starboard' });
    expect(getTwa({ twd, bearing: 90 })).toEqual({ angle: 90, tack: 'starboard' });
    expect(getTwa({ twd, bearing: 135 })).toEqual({ angle: 45, tack: 'starboard' });

    expect(getTwa({ twd, bearing: 180 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd, bearing: 0 })).toEqual({ angle: 180, tack: null });
  });
  test('Returns the correct values for 270 TWD', () => {
    const twd = 270;

    expect(getTwa({ twd, bearing: 315 })).toEqual({ angle: 45, tack: 'port' });
    expect(getTwa({ twd, bearing: 0 })).toEqual({ angle: 90, tack: 'port' });
    expect(getTwa({ twd, bearing: 45 })).toEqual({ angle: 135, tack: 'port' });

    expect(getTwa({ twd, bearing: 135 })).toEqual({ angle: 135, tack: 'starboard' });
    expect(getTwa({ twd, bearing: 180 })).toEqual({ angle: 90, tack: 'starboard' });
    expect(getTwa({ twd, bearing: 225 })).toEqual({ angle: 45, tack: 'starboard' });

    expect(getTwa({ twd, bearing: 270 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd, bearing: 90 })).toEqual({ angle: 180, tack: null });
  });
  test('Returns 0 for the same angles', () => {
    0;
    expect(getTwa({ twd: 0, bearing: 0 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd: 0, bearing: 360 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd: 90, bearing: 90 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd: 90, bearing: 450 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd: 180, bearing: 180 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd: 180, bearing: 540 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd: 270, bearing: 270 })).toEqual({ angle: 0, tack: null });
    expect(getTwa({ twd: 270, bearing: 630 })).toEqual({ angle: 0, tack: null });
  });
});
