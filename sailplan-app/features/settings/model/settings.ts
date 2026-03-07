import { z } from 'zod';

export const SpeedUnit = z.enum(['kn', 'km/h', 'm/s', 'mi/h']);
export type SpeedUnit = z.infer<typeof SpeedUnit>;

export const AreaUnit = z.enum(['m^2', 'ft^2']);
export type AreaUnit = z.infer<typeof AreaUnit>;

export const DistanceUnit = z.enum(['nm', 'km', 'mi']);
export type DistanceUnit = z.infer<typeof DistanceUnit>;

export const CoordFormatDefault = z.enum(['DMS', 'DMM']);
export type CoordFormatDefault = z.infer<typeof CoordFormatDefault>;

export const HemisphereLatitude = z.enum(['N', 'S']);
export type HemisphereLatitude = z.infer<typeof HemisphereLatitude>;

export const HemisphereLongitude = z.enum(['E', 'W']);
export type HemisphereLongitude = z.infer<typeof HemisphereLongitude>;

export const ThemePreference = z.enum(['light', 'dark']);
export type ThemePreference = z.infer<typeof ThemePreference>;

export interface Settings {
  speedUnit: SpeedUnit;
  areaUnit: AreaUnit;
  distanceUnit: DistanceUnit;
  coordFormat: CoordFormatDefault;
  hemisphereLatitude: HemisphereLatitude;
  hemisphereLongitude: HemisphereLongitude;
  mapZoom: number;
}

export const DEFAULT_SETTINGS: Settings = {
  speedUnit: 'kn',
  areaUnit: 'm^2',
  distanceUnit: 'nm',
  coordFormat: 'DMS',
  hemisphereLatitude: 'S',
  hemisphereLongitude: 'E',
  mapZoom: 0.15,
};
