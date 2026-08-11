import TcpSocket from 'react-native-tcp-socket';
import type { ManualPlotterSetupFormValues } from '../model/plotterSetup';

export const PLOTTER_CONNECTION_TEST_TIMEOUT_MS = 5_000;

type TestSocket = {
  once: (
    event: 'error' | 'timeout',
    listener: (error?: Error) => void,
  ) => unknown;
  destroy: () => unknown;
};

type CreateConnection = (
  options: {
    host: string;
    port: number;
    interface: 'wifi';
    connectTimeout: number;
  },
  onConnect: () => void,
) => TestSocket;

/**
 * Opens and immediately closes a Wi-Fi TCP connection. This proves only that
 * the pinned endpoint accepts TCP; it does not require valid NMEA data and is
 * intentionally separate from whether the plotter setup is configured.
 */
export function testPlotterConnection(
  endpoint: ManualPlotterSetupFormValues,
  createConnection: CreateConnection = TcpSocket.createConnection,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let socket: TestSocket | undefined;
    let connectedBeforeSocketAssigned = false;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket?.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket = createConnection(
      {
        host: endpoint.host,
        port: endpoint.port,
        interface: 'wifi',
        connectTimeout: PLOTTER_CONNECTION_TEST_TIMEOUT_MS,
      },
      () => {
        connectedBeforeSocketAssigned = socket === undefined;
        finish();
      },
    );

    if (connectedBeforeSocketAssigned) socket.destroy();
    socket.once('error', error => finish(error ?? new Error('Connection failed')));
    socket.once('timeout', () => finish(new Error('Connection timed out')));
  });
}
