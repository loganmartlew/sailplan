import { manualPlotterSetupFormSchema } from '../plotterSetup';

describe('manualPlotterSetupFormSchema', () => {
  it.each([
    ['192.168.1.1', 10110],
    ['plotter.local', '10110'],
    ['169.254.42.8', 1],
    ['zeus', 65535],
  ])('accepts a valid manual endpoint: %s:%s', (host, port) => {
    expect(manualPlotterSetupFormSchema.parse({ host, port })).toEqual({
      host,
      port: Number(port),
    });
  });

  it.each([
    { host: '', port: 10110 },
    { host: 'plotter address', port: 10110 },
    { host: 'plotter.local', port: 0 },
    { host: 'plotter.local', port: 65536 },
    { host: 'plotter.local', port: 10110.5 },
  ])('rejects an invalid manual endpoint: %#', endpoint => {
    expect(() => manualPlotterSetupFormSchema.parse(endpoint)).toThrow();
  });
});
