import type { SpeedUnit, AreaUnit, DistanceUnit } from '~/features/settings';

// #####################
// ####### ANGLE #######
// #####################

const numberFormatOptions: Intl.NumberFormatOptions = {
  style: 'unit',
  unit: 'degree',
  unitDisplay: 'narrow',
  maximumFractionDigits: 1,
};

const angleFormat = new Intl.NumberFormat('en-NZ', numberFormatOptions);

export const formatAngle = (
  angle: number,
  options?: Partial<Intl.NumberFormatOptions>,
): string => {
  if (options) {
    const customFormat = new Intl.NumberFormat('en-NZ', {
      ...numberFormatOptions,
      ...options,
    });
    return customFormat.format(angle);
  }

  return angleFormat.format(angle);
};

// #####################
// ####### SPEED #######
// #####################

const speedFormat = new Intl.NumberFormat('en-NZ', {
  style: 'decimal',
  maximumFractionDigits: 2,
});

export const DEFAULT_SPEED_UNIT: SpeedUnit = 'kn';

const SPEED_CONVERSIONS: Record<SpeedUnit, { factor: number; label: string }> =
  {
    kn: { factor: 1, label: 'kn' },
    'km/h': { factor: 1.852, label: 'km/h' },
    'm/s': { factor: 0.514444, label: 'm/s' },
    'mi/h': { factor: 1.15078, label: 'mi/h' },
  };

export const formatSpeed = (
  speed: number,
  unit: SpeedUnit = DEFAULT_SPEED_UNIT,
): string => {
  const { label } = SPEED_CONVERSIONS[unit];
  return `${speedFormat.format(convertSpeed(speed, DEFAULT_SPEED_UNIT, unit))} ${label}`;
};

export const convertSpeed = (
  speed: number,
  fromUnit: SpeedUnit,
  toUnit: SpeedUnit = DEFAULT_SPEED_UNIT,
): number => {
  const { factor: fromFactor } = SPEED_CONVERSIONS[fromUnit];
  const { factor: toFactor } = SPEED_CONVERSIONS[toUnit];
  return (speed * fromFactor) / toFactor;
};

export const getSpeedUnitLabel = (unit: SpeedUnit): string =>
  SPEED_CONVERSIONS[unit].label;

// #####################
// ####### AREA ########
// #####################

export const DEFAULT_AREA_UNIT: AreaUnit = 'm^2';

const AREA_CONVERSIONS: Record<AreaUnit, { factor: number; label: string }> = {
  'm^2': { factor: 1, label: 'm^2' },
  'ft^2': { factor: 10.7639, label: 'ft^2' },
};

export const formatArea = (
  area: number,
  unit: AreaUnit = DEFAULT_AREA_UNIT,
): string => {
  const { label } = AREA_CONVERSIONS[unit];
  const formatted = new Intl.NumberFormat('en-NZ', {
    style: 'decimal',
    maximumFractionDigits: 1,
  }).format(convertArea(area, DEFAULT_AREA_UNIT, unit));
  return `${formatted} ${label}`;
};

export const convertArea = (
  area: number,
  fromUnit: AreaUnit,
  toUnit: AreaUnit = DEFAULT_AREA_UNIT,
): number => {
  const { factor: fromFactor } = AREA_CONVERSIONS[fromUnit];
  const { factor: toFactor } = AREA_CONVERSIONS[toUnit];
  return (area * fromFactor) / toFactor;
};

export const getAreaUnitLabel = (unit: AreaUnit): string =>
  AREA_CONVERSIONS[unit].label;

// #####################
// ###### DISTANCE #####
// #####################

const DISTANCE_CONVERSIONS: Record<
  DistanceUnit,
  { factor: number; label: string }
> = {
  nm: { factor: 1, label: 'nm' },
  km: { factor: 1.852, label: 'km' },
  mi: { factor: 1.15078, label: 'mi' },
};

export const formatDistance = (
  distance: number,
  unit: DistanceUnit = 'nm',
): string => {
  const { factor, label } = DISTANCE_CONVERSIONS[unit];
  const formatted = new Intl.NumberFormat('en-NZ', {
    style: 'decimal',
    maximumFractionDigits: 2,
  }).format(distance * factor);
  return `${formatted} ${label}`;
};

// #####################
// ####### COUNT #######
// #####################

const countFormat = new Intl.NumberFormat('en-NZ');

/**
 * A plain thousands-separated count. Capture talks in tens of thousands of
 * samples, and four screens had each declared their own `Intl.NumberFormat`.
 */
export const formatCount = (count: number): string => countFormat.format(count);
