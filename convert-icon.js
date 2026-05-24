import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const iconPath = './public/icons/icon.svg';
const outputDir = './public/icons';

const sizes = [
  { size: 16, name: 'icon16.png' },
  { size: 32, name: 'icon32.png' },
  { size: 48, name: 'icon48.png' },
  { size: 128, name: 'icon128.png' }
];

async function convertIcon() {
  try {
    console.log('Starting SVG to PNG conversion...');
    
    for (const { size, name } of sizes) {
      const outputPath = path.join(outputDir, name);
      console.log(`Converting to ${size}x${size}...`);
      
      await sharp(iconPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 2, g: 5, b: 15, alpha: 1 } // #02050f
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Created ${name}`);
    }
    
    console.log('\n✓ All conversions completed successfully!');
  } catch (error) {
    console.error('Error during conversion:', error);
    process.exit(1);
  }
}

convertIcon();
