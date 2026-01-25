const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../lib/icons');
const indexPath = path.join(iconsDir, 'index.tsx');

// Read all files in the icons directory
const files = fs.readdirSync(iconsDir);

// Filter for .tsx and .ts files, excluding index.tsx
const iconFiles = files
  .filter(file => {
    const ext = path.extname(file);
    return (ext === '.tsx' || ext === '.ts') && file !== 'index.tsx';
  })
  .map(file => path.basename(file, path.extname(file)))
  .sort();

// Generate export statements
const exportString = iconFiles
  .map(fileName => `export * from './${fileName}';`)
  .join('\n');

// Write to index.tsx
fs.writeFileSync(indexPath, exportString + '\n');

console.log(
  `✅ Generated ${iconFiles.length} icon exports in lib/icons/index.tsx`,
);
