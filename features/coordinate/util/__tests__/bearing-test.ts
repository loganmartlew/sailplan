import { getTwa } from '../bearing';

describe('getTwa', () => {
  test('Returns the correct values for 0 TWD', () => {
    const twd = 0;

    expect(getTwa(twd, 45)).toEqual({ angle: 45, tack: 'port' });
    expect(getTwa(twd, 90)).toEqual({ angle: 90, tack: 'port' });
    expect(getTwa(twd, 135)).toEqual({ angle: 135, tack: 'port' });

    expect(getTwa(twd, 225)).toEqual({ angle: 135, tack: 'starboard' });
    expect(getTwa(twd, 270)).toEqual({ angle: 90, tack: 'starboard' });
    expect(getTwa(twd, 315)).toEqual({ angle: 45, tack: 'starboard' });

    expect(getTwa(twd, 0)).toEqual({ angle: 0, tack: null });
    expect(getTwa(twd, 180)).toEqual({ angle: 180, tack: null });
  });
  test('Returns the correct values for 90 TWD', () => {
    const twd = 90;

    expect(getTwa(twd, 135)).toEqual({ angle: 45, tack: 'port' });
    expect(getTwa(twd, 180)).toEqual({ angle: 90, tack: 'port' });
    expect(getTwa(twd, 225)).toEqual({ angle: 135, tack: 'port' });

    expect(getTwa(twd, 315)).toEqual({ angle: 135, tack: 'starboard' });
    expect(getTwa(twd, 0)).toEqual({ angle: 90, tack: 'starboard' });
    expect(getTwa(twd, 45)).toEqual({ angle: 45, tack: 'starboard' });

    expect(getTwa(twd, 90)).toEqual({ angle: 0, tack: null });
    expect(getTwa(twd, 270)).toEqual({ angle: 180, tack: null });
  });
  test('Returns the correct values for 180 TWD', () => {
    const twd = 180;

    expect(getTwa(twd, 225)).toEqual({ angle: 45, tack: 'port' });
    expect(getTwa(twd, 270)).toEqual({ angle: 90, tack: 'port' });
    expect(getTwa(twd, 315)).toEqual({ angle: 135, tack: 'port' });

    expect(getTwa(twd, 45)).toEqual({ angle: 135, tack: 'starboard' });
    expect(getTwa(twd, 90)).toEqual({ angle: 90, tack: 'starboard' });
    expect(getTwa(twd, 135)).toEqual({ angle: 45, tack: 'starboard' });

    expect(getTwa(twd, 180)).toEqual({ angle: 0, tack: null });
    expect(getTwa(twd, 0)).toEqual({ angle: 180, tack: null });
  });
  test('Returns the correct values for 270 TWD', () => {
    const twd = 270;

    expect(getTwa(twd, 315)).toEqual({ angle: 45, tack: 'port' });
    expect(getTwa(twd, 0)).toEqual({ angle: 90, tack: 'port' });
    expect(getTwa(twd, 45)).toEqual({ angle: 135, tack: 'port' });

    expect(getTwa(twd, 135)).toEqual({ angle: 135, tack: 'starboard' });
    expect(getTwa(twd, 180)).toEqual({ angle: 90, tack: 'starboard' });
    expect(getTwa(twd, 225)).toEqual({ angle: 45, tack: 'starboard' });

    expect(getTwa(twd, 270)).toEqual({ angle: 0, tack: null });
    expect(getTwa(twd, 90)).toEqual({ angle: 180, tack: null });
  });
  test('Returns 0 for the same angles', () => {
    0;
    expect(getTwa(0, 0)).toEqual({ angle: 0, tack: null });
    expect(getTwa(0, 360)).toEqual({ angle: 0, tack: null });
    expect(getTwa(90, 90)).toEqual({ angle: 0, tack: null });
    expect(getTwa(90, 450)).toEqual({ angle: 0, tack: null });
    expect(getTwa(180, 180)).toEqual({ angle: 0, tack: null });
    expect(getTwa(180, 540)).toEqual({ angle: 0, tack: null });
    expect(getTwa(270, 270)).toEqual({ angle: 0, tack: null });
    expect(getTwa(270, 630)).toEqual({ angle: 0, tack: null });
  });
});
