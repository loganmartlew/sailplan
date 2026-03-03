const fs = require('fs');
const path = require('path');

// Get the icon name from command line arguments
const iconName = process.argv[2];

if (!iconName) {
  console.error('❌ Error: Please provide an icon name');
  console.log('Usage: npm run generate:icon <IconName>');
  console.log('Example: npm run generate:icon Search');
  process.exit(1);
}

// Validate icon name format (should be PascalCase)
if (!/^[A-Z][a-zA-Z0-9]*$/.test(iconName)) {
  console.error(
    '❌ Error: Icon name must be in PascalCase (e.g., Search, ChevronDown, MapPin)',
  );
  process.exit(1);
}

const iconsDir = path.join(__dirname, '../lib/icons');
const iconFilePath = path.join(iconsDir, `${iconName}.tsx`);

// Check if file already exists
if (fs.existsSync(iconFilePath)) {
  console.error(`❌ Error: Icon file ${iconName}.tsx already exists`);
  process.exit(1);
}

// Generate the icon file content
const iconContent = `import { ${iconName} } from 'lucide-react-native';
import { iconWithClassName } from './iconWithClassName';
iconWithClassName(${iconName});
export { ${iconName} };
`;

// Write the icon file
fs.writeFileSync(iconFilePath, iconContent);

console.log(`✅ Created ${iconName}.tsx in lib/icons/`);
console.log(
  `💡 Don't forget to run 'npm run generate:icons' to update the index.tsx`,
);
