const fs = require('fs');
const path = require('path');

// Read VERO lists
const veroList1 = fs.readFileSync(path.join(__dirname, '../salvage/vero/VeroList.txt'), 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
const veroList2 = fs.readFileSync(path.join(__dirname, '../salvage/vero/VeroListNew.txt'), 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
const restrictedWords = fs.readFileSync(path.join(__dirname, '../salvage/vero/restricted_words.txt'), 'utf8').split('\n').map(l => l.trim()).filter(Boolean);

// Combine and deduplicate VERO brands (case-insensitive)
const allBrands = [...veroList1, ...veroList2];
const brandMap = new Map();
allBrands.forEach(brand => {
  const lower = brand.toLowerCase();
  if (!brandMap.has(lower)) {
    brandMap.set(lower, brand);
  }
});

const uniqueBrands = Array.from(brandMap.values()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

console.log(`Total VERO brands: ${uniqueBrands.length}`);
console.log(`Restricted words: ${restrictedWords.length}`);

// Generate TypeScript array content
const brandsArray = uniqueBrands.map(b => `  '${b.replace(/'/g, "\\'")}'`).join(',\n');
const restrictedArray = restrictedWords.map(w => `  '${w.replace(/'/g, "\\'")}'`).join(',\n');

// Read current compliance.ts
const compliancePath = path.join(__dirname, 'src/services/compliance.ts');
let compliance = fs.readFileSync(compliancePath, 'utf8');

// Replace VERO_BRANDS array
const veroStart = compliance.indexOf('const VERO_BRANDS');
const veroEnd = compliance.indexOf('];', veroStart) + 2;
const beforeVero = compliance.substring(0, veroStart);
const afterVero = compliance.substring(veroEnd);

const newVeroSection = `// Full VERO brand list (${uniqueBrands.length} brands merged from VeroList.txt + VeroListNew.txt)
export const VERO_BRANDS = [\n${brandsArray}\n];

// Restricted words from eBay policy
const RESTRICTED_WORDS = [\n${restrictedArray}\n`;

const newCompliance = beforeVero + newVeroSection + afterVero;

// Update checkBannedItems to include restricted words
const updatedCompliance = newCompliance.replace(
  'for (const keyword of BANNED_KEYWORDS) {',
  `// Check banned keywords
  for (const keyword of BANNED_KEYWORDS) {`
).replace(
  'return {\n    passed: true,\n    reason: \'No banned items detected\'\n  };\n}',
  `return {\n    passed: true,\n    reason: 'No banned items detected'\n  };\n}\n\n/**\n * Check if product contains restricted words\n */\nfunction checkRestrictedWords(product: AmazonProduct): { passed: boolean; reason: string } {\n  const titleLower = product.title.toLowerCase();\n  \n  for (const word of RESTRICTED_WORDS) {\n    if (titleLower.includes(word.toLowerCase())) {\n      return {\n        passed: false,\n        reason: \`Restricted word detected: contains "\${word}"\`\n      };\n    }\n  }\n  \n  return {\n    passed: true,\n    reason: 'No restricted words detected'\n  };\n}`
);

fs.writeFileSync(compliancePath, updatedCompliance, 'utf8');
console.log('✓ Updated compliance.ts with merged VERO list and restricted words');
