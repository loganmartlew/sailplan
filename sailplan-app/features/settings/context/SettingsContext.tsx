import { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { useMMKVString, useMMKVNumber } from 'react-native-mmkv';
import {
  DEFAULT_SETTINGS,
  Settings,
  SpeedUnit,
  AreaUnit,
  DistanceUnit,
  CoordFormatDefault,
  HemisphereLatitude,
  HemisphereLongitude,
  PolarChartType,
} from '../model/settings';

interface SettingsContextType extends Settings {
  setSpeedUnit: (unit: SpeedUnit) => void;
  setAreaUnit: (unit: AreaUnit) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setCoordFormat: (format: CoordFormatDefault) => void;
  setHemisphereLatitude: (hemisphere: HemisphereLatitude) => void;
  setHemisphereLongitude: (hemisphere: HemisphereLongitude) => void;
  setMapZoom: (zoom: number) => void;
  setPolarChartType: (type: PolarChartType) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: PropsWithChildren) {
  const [speedUnit, setSpeedUnit] = useMMKVString('settings.speedUnit');
  const [areaUnit, setAreaUnit] = useMMKVString('settings.areaUnit');
  const [distanceUnit, setDistanceUnit] = useMMKVString(
    'settings.distanceUnit',
  );
  const [coordFormat, setCoordFormat] = useMMKVString('settings.coordFormat');
  const [hemisphereLatitude, setHemisphereLatitude] = useMMKVString(
    'settings.hemisphereLatitude',
  );
  const [hemisphereLongitude, setHemisphereLongitude] = useMMKVString(
    'settings.hemisphereLongitude',
  );
  const [mapZoom, setMapZoom] = useMMKVNumber('settings.mapZoom');
  const [polarChartType, setPolarChartType] = useMMKVString(
    'settings.polarChartType',
  );

  const value = useMemo<SettingsContextType>(
    () => ({
      speedUnit: (speedUnit as SpeedUnit) ?? DEFAULT_SETTINGS.speedUnit,
      areaUnit: (areaUnit as AreaUnit) ?? DEFAULT_SETTINGS.areaUnit,
      distanceUnit:
        (distanceUnit as DistanceUnit) ?? DEFAULT_SETTINGS.distanceUnit,
      coordFormat:
        (coordFormat as CoordFormatDefault) ?? DEFAULT_SETTINGS.coordFormat,
      hemisphereLatitude:
        (hemisphereLatitude as HemisphereLatitude) ??
        DEFAULT_SETTINGS.hemisphereLatitude,
      hemisphereLongitude:
        (hemisphereLongitude as HemisphereLongitude) ??
        DEFAULT_SETTINGS.hemisphereLongitude,
      mapZoom: mapZoom ?? DEFAULT_SETTINGS.mapZoom,
      polarChartType:
        (polarChartType as PolarChartType) ?? DEFAULT_SETTINGS.polarChartType,
      setSpeedUnit,
      setAreaUnit,
      setDistanceUnit,
      setCoordFormat,
      setHemisphereLatitude,
      setHemisphereLongitude,
      setMapZoom: (zoom: number) => setMapZoom(zoom),
      setPolarChartType,
    }),
    [
      speedUnit,
      areaUnit,
      distanceUnit,
      coordFormat,
      hemisphereLatitude,
      hemisphereLongitude,
      mapZoom,
      polarChartType,
    ],
  );

  return <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
