const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function processScreenshots() {
  const inputDir = '.chrome_store';
  const outputDir = '.chrome_store/processed';
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Chrome Web Store requires 1280x800 or 640x400
  const targetSizes = [
    { width: 1280, height: 800, suffix: '1280x800' },
    { width: 640, height: 400, suffix: '640x400' }
  ];
  
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.png'));
  
  console.log(`Found ${files.length} PNG files to process`);
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const basename = path.basename(file, '.png');
    
    // Get original image metadata
    const metadata = await sharp(inputPath).metadata();
    console.log(`\n${file}: ${metadata.width}x${metadata.height}`);
    
    for (const size of targetSizes) {
      const outputName = `${basename}_${size.suffix}.jpg`;
      const outputPath = path.join(outputDir, outputName);
      
      try {
        await sharp(inputPath)
          .resize(size.width, size.height, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({
            quality: 95,
            mozjpeg: true
          })
          .toFile(outputPath);
        
        console.log(`  ✓ Created ${outputName}`);
      } catch (err) {
        console.error(`  ✗ Failed to create ${outputName}: ${err.message}`);
      }
    }
  }
  
  console.log(`\nProcessed screenshots saved to ${outputDir}/`);
  console.log('\nFor Chrome Web Store submission:');
  console.log('- Use the 1280x800 versions for best quality');
  console.log('- Or use 640x400 versions if file size is a concern');
  console.log('- You can upload up to 5 screenshots');
}

processScreenshots().catch(console.error);