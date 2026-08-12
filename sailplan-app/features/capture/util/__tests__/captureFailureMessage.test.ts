import {
  CaptureRecordingStartError,
  connectFailureReason,
  type CaptureStartReason,
} from '../../model/captureRecordingError';
import { captureFailureMessage } from '../captureFailureMessage';

const messageFor = (reason: CaptureStartReason) =>
  captureFailureMessage(
    new CaptureRecordingStartError(
      reason === 'unreachable' || reason === 'refused'
        ? 'connecting'
        : 'preparing',
      reason,
      new Error('underlying detail the sailor never sees'),
    ),
  );

describe('captureFailureMessage', () => {
  it('tells a sailor off the boat network to join it', () => {
    expect(messageFor('unreachable')).toMatch(/connect to the boat wi-fi/i);
    expect(messageFor('unreachable')).toMatch(/stay connected/i);
  });

  it('distinguishes being on Wi-Fi from not reaching the network at all', () => {
    expect(messageFor('refused')).toMatch(/reached wi-fi/i);
    expect(messageFor('refused')).not.toBe(messageFor('unreachable'));
  });

  it('never presents a local failure as a bad plotter address', () => {
    for (const reason of [
      'notification-permission-denied',
      'service-unavailable',
      'storage',
    ] as const) {
      expect(messageFor(reason)).toMatch(/connected to the plotter/i);
    }
  });

  it('gives every reason its own message', () => {
    const reasons: CaptureStartReason[] = [
      'unreachable',
      'refused',
      'notification-permission-denied',
      'service-unavailable',
      'storage',
    ];
    expect(new Set(reasons.map(messageFor)).size).toBe(reasons.length);
  });

  it('never leaks the underlying error text to the sailor', () => {
    expect(messageFor('storage')).not.toMatch(/underlying detail/);
  });

  it('falls back to the plotter-not-found message for an unknown error', () => {
    expect(captureFailureMessage(new Error('something else'))).toBe(
      messageFor('refused'),
    );
  });
});

describe('connectFailureReason', () => {
  it.each([
    'Connection timed out',
    // The message the socket really emits on the no-route path. The suite used
    // to assert only on the string this module generates itself, so a regex
    // that missed every real timeout still passed. MT5/B7 found it on device.
    'connect ETIMEDOUT 10.0.0.1:10110',
    'ETIMEDOUT',
    'connect EHOSTUNREACH 10.0.0.1:10110',
    'connect ENETUNREACH 10.0.0.1:10110',
    'no route to host',
  ])('reads %s as unreachable', message => {
    expect(connectFailureReason(new Error(message))).toBe('unreachable');
  });

  it.each(['connect ECONNREFUSED 10.0.0.1:10110', 'socket hang up'])(
    'reads %s as refused',
    message => {
      expect(connectFailureReason(new Error(message))).toBe('refused');
    },
  );
});
