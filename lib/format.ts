const angleFormat = new Intl.NumberFormat('en-NZ', {
  style: 'unit',
  unit: 'degree',
  unitDisplay: 'narrow',
  maximumFractionDigits: 1,
});

export const formatAngle = (angle: number): string => {
  return angleFormat.format(angle);
};

const speedFormat = new Intl.NumberFormat('en-NZ', {
  style: 'decimal',
  maximumFractionDigits: 2,
});

export const formatSpeed = (speed: number): string => {
  const speedString = speedFormat.format(speed);
  return `${speedString} kn`;
};
