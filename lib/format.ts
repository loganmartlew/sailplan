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

const speedFormat = new Intl.NumberFormat('en-NZ', {
  style: 'decimal',
  maximumFractionDigits: 2,
});

export const formatSpeed = (speed: number): string => {
  const speedString = speedFormat.format(speed);
  return `${speedString} kn`;
};
