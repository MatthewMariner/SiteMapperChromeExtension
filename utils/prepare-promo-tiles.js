const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createPromoTiles() {
  const outputDir = '.chrome_store/promo';
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Use the first screenshot as base
  const baseImage = '.chrome_store/1.png';
  
  if (!fs.existsSync(baseImage)) {
    console.error('Base image not found:', baseImage);
    return;
  }
  
  // Chrome Web Store promotional tiles
  const tiles = [
    { width: 440, height: 280, name: 'small_promo_tile.jpg' },
    { width: 1400, height: 560, name: 'marquee_promo_tile.jpg' }
  ];
  
  // Create background with branding
  for (const tile of tiles) {
    const outputPath = path.join(outputDir, tile.name);
    
    try {
      // Create a branded background
      const background = Buffer.from(
        `<svg width="${tile.width}" height="${tile.height}">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#0f0f23;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="${tile.width}" height="${tile.height}" fill="url(#bg)"/>
          <text x="${tile.width/2}" y="${tile.height/2 - 50}" font-family="Arial, sans-serif" font-size="${tile.width > 1000 ? '72' : '36'}" font-weight="bold" fill="#5090d3" text-anchor="middle">Site Structure Navigator</text>
          <text x="${tile.width/2}" y="${tile.height/2 + 10}" font-family="Arial, sans-serif" font-size="${tile.width > 1000 ? '32' : '18'}" fill="#8ca2c0" text-anchor="middle">Discover and Navigate Website Structure</text>
          <text x="${tile.width/2}" y="${tile.height/2 + 50}" font-family="Arial, sans-serif" font-size="${tile.width > 1000 ? '24' : '14'}" fill="#6b7c93" text-anchor="middle">Smart Sitemap Detection • Visual Tree View • Export Tools</text>
        </svg>`
      );
      
      // Create the promo tile
      await sharp(background)
        .jpeg({ quality: 95, mozjpeg: true })
        .toFile(outputPath);
      
      console.log(`✓ Created ${tile.name} (${tile.width}x${tile.height})`);
    } catch (err) {
      console.error(`✗ Failed to create ${tile.name}: ${err.message}`);
    }
  }
  
  // Also check/create store icon
  const iconPath = 'src/icons/icon-128.png';
  const storeIconPath = path.join(outputDir, 'store_icon_128.png');
  
  if (fs.existsSync(iconPath)) {
    const metadata = await sharp(iconPath).metadata();
    if (metadata.width === 128 && metadata.height === 128) {
      fs.copyFileSync(iconPath, storeIconPath);
      console.log('✓ Store icon ready (128x128)');
    }
  }
  
  console.log(`\nPromo assets saved to ${outputDir}/`);
}

createPromoTiles().catch(console.error);