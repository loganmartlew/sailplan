const marks = require('./waitemata-marks.json');
const fs = require('fs');

function dmmToDecimal(degrees, minutes, cardinality) {
  const decimalDegrees = (degrees + minutes / 60) * cardinality;
  return parseFloat(decimalDegrees.toFixed(8));
}

const mappedMarks = marks.map(mark => {
  const { latitude, longitude } = mark;

  const newLat = dmmToDecimal(
    latitude.deg < 0 ? -latitude.deg : latitude.deg,
    latitude.min,
    latitude.deg < 0 ? -1 : 1
  );

  const newLon = dmmToDecimal(
    longitude.deg < 0 ? -longitude.deg : longitude.deg,
    longitude.min,
    longitude.deg < 0 ? -1 : 1
  );

  return {
    ...mark,
    latitude: newLat,
    longitude: newLon,
  };
});

const newJson = JSON.stringify(mappedMarks, null, 2);

fs.writeFileSync('./scripts/waitemata-marks-output.json', newJson, 'utf8');
