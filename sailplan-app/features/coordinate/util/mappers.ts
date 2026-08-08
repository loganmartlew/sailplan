import { Cardinality, CompassDirection } from './types';

export function dmsToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  cardinality: Cardinality
) {
  const decimalDegrees =
    (degrees + minutes / 60 + seconds / 3600) * cardinality;
  return parseFloat(decimalDegrees.toFixed(8));
}

export function decimalToDMS(decimalDegrees: number): {
  degrees: number;
  minutes: number;
  seconds: number;
  cardinality: Cardinality;
} {
  const cardinality = decimalDegrees < 0 ? -1 : 1;
  const degrees = Math.floor(decimalDegrees);
  const minutes = Math.floor((decimalDegrees - degrees) * 60);
  const seconds = parseFloat(
    ((decimalDegrees - degrees - minutes / 60) * 3600).toFixed(8)
  );
  return { degrees, minutes, seconds, cardinality };
}

export function dmmToDecimal(
  degrees: number,
  minutes: number,
  cardinality: Cardinality
) {
  const decimalDegrees = (degrees + minutes / 60) * cardinality;
  return parseFloat(decimalDegrees.toFixed(8));
}

export function decimalToDMM(decimalDegrees: number): {
  degrees: number;
  minutes: number;
  cardinality: Cardinality;
} {
  const cardinality = decimalDegrees < 0 ? -1 : 1;
  const degrees = Math.floor(decimalDegrees);
  const minutes = parseFloat((decimalDegrees - degrees).toFixed(8)) * 60;
  return { degrees, minutes, cardinality };
}

export function compassToCardinality(compassDirection: CompassDirection) {
  return compassDirection === CompassDirection.enum.N ||
    compassDirection === CompassDirection.enum.E
    ? 1
    : -1;
}

export function cardinalityToCompass(
  cardinality: -1 | 1,
  field: 'latitude' | 'longitude'
) {
  return cardinality === 1
    ? field === 'latitude'
      ? CompassDirection.enum.N
      : CompassDirection.enum.E
    : field === 'latitude'
    ? CompassDirection.enum.S
    : CompassDirection.enum.W;
}
