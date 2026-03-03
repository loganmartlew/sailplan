const fs = require('fs');

const sails = {
  A6: {
    twaRange: [95, 120],
    baseSpeeds: { 4: 2.8, 10: 8.5, 16: 10.5, 26: 13.8 },
  },
  A5: {
    twaRange: [110, 130],
    baseSpeeds: { 4: 3.1, 10: 8.4, 16: 11.7, 26: 15.4 },
  },
  A3: {
    twaRange: [125, 140],
    baseSpeeds: { 4: 3.2, 10: 8.2, 16: 13.4, 26: 19.8 },
  },
  A2: {
    twaRange: [140, 165],
    baseSpeeds: { 4: 2.8, 10: 7.5, 16: 11.9, 26: 21.0 },
  },
  'S1.5': {
    twaRange: [150, 170],
    baseSpeeds: { 4: 2.6, 10: 7.0, 16: 11.0, 26: 18.3 },
  },
  S1: {
    twaRange: [165, 180],
    baseSpeeds: { 4: 2.2, 10: 6.3, 16: 9.4, 26: 14.8 },
  },
};

// Helper for linear interpolation to get base speed for any TWS
function getInterpolatedBaseSpeed(tws, baseSpeeds) {
  const keys = Object.keys(baseSpeeds)
    .map(Number)
    .sort((a, b) => a - b);
  if (tws <= keys[0]) return baseSpeeds[keys[0]];
  if (tws >= keys[keys.length - 1]) return baseSpeeds[keys[keys.length - 1]];

  for (let i = 0; i < keys.length - 1; i++) {
    let x0 = keys[i],
      x1 = keys[i + 1];
    let y0 = baseSpeeds[x0],
      y1 = baseSpeeds[x1];
    if (tws >= x0 && tws <= x1) {
      return y0 + ((tws - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
}

let csvRows = ['Timestamp,Sail,TWS,TWA,BoatSpeed,Notes'];

Object.keys(sails).forEach(sailName => {
  const sail = sails[sailName];

  // TWS from 4 to 26 in 2kt increments
  for (let tws = 4; tws <= 26; tws += 2) {
    // TWA in 5 degree increments
    for (let twa = sail.twaRange[0]; twa <= sail.twaRange[1]; twa += 5) {
      const baseV = getInterpolatedBaseSpeed(tws, sail.baseSpeeds);

      // Generate 3 entries per node
      for (let i = 0; i < 3; i++) {
        const timestamp = new Date(
          Date.now() - Math.random() * 100000000,
        ).toISOString();
        const tws_noise = (tws + (Math.random() * 0.6 - 0.3)).toFixed(2);
        const twa_noise = twa + Math.floor(Math.random() * 5 - 2);

        // Randomly simulate: 0=Great trim, 1=Poor trim, 2=Dynamic (Surf/Wipeout)
        let speedFactor;
        let note = 'Normal';
        const roll = Math.random();

        if (roll > 0.85) {
          // The "Flyer" (Surfing)
          speedFactor = 1.05 + Math.random() * 0.1;
          note = 'Surfing/Planing';
        } else if (roll < 0.2) {
          // The "Dog" (Bad trim/Lull)
          speedFactor = 0.82 + Math.random() * 0.1;
          note = 'Poor Trim';
        } else {
          // Solid performance
          speedFactor = 0.97 + Math.random() * 0.06;
          note = 'On Target';
        }

        const boatSpeed = (baseV * speedFactor).toFixed(2);
        csvRows.push(
          `${timestamp},${sailName},${tws_noise},${twa_noise},${boatSpeed},${note}`,
        );
      }
    }
  }
});

// Save to file
fs.writeFileSync('polars_random.csv', csvRows.join('\n'));
console.log(`Generated ${csvRows.length - 1} data points in polars_random.csv`);
