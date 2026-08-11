import {
  PLOTTER_CONNECTION_TEST_TIMEOUT_MS,
  testPlotterConnection,
} from '../testPlotterConnection';

jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: { createConnection: jest.fn() },
}));

type Listener = (error?: Error) => void;

function makeSocket() {
  const listeners: Partial<Record<'error' | 'timeout', Listener>> = {};
  return {
    socket: {
      once: jest.fn((event: 'error' | 'timeout', listener: Listener) => {
        listeners[event] = listener;
      }),
      destroy: jest.fn(),
    },
    listeners,
  };
}

describe('testPlotterConnection', () => {
  const endpoint = { host: '192.168.1.1', port: 10110 };

  it('opens the pinned endpoint on Wi-Fi and closes after connecting', async () => {
    const { socket } = makeSocket();
    let onConnect: (() => void) | undefined;
    const createConnection = jest.fn((_options, callback) => {
      onConnect = callback;
      return socket;
    });

    const result = testPlotterConnection(endpoint, createConnection);

    expect(createConnection).toHaveBeenCalledWith(
      {
        ...endpoint,
        interface: 'wifi',
        connectTimeout: PLOTTER_CONNECTION_TEST_TIMEOUT_MS,
      },
      expect.any(Function),
    );
    onConnect?.();
    await expect(result).resolves.toBeUndefined();
    expect(socket.destroy).toHaveBeenCalledTimes(1);
  });

  it('rejects and closes when the socket errors', async () => {
    const { socket, listeners } = makeSocket();
    const createConnection = jest.fn(() => socket);

    const result = testPlotterConnection(endpoint, createConnection);
    const failure = new Error('Connection refused');
    listeners.error?.(failure);

    await expect(result).rejects.toThrow('Connection refused');
    expect(socket.destroy).toHaveBeenCalledTimes(1);
  });
});
