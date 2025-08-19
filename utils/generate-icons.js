// generate-icons.js
const fs = require("fs").promises;
const sharp = require("sharp");

const sizes = [16, 48, 128];

async function generateIcons() {
  try {
    // Ensure the icons directory exists
    await fs.mkdir("./src/icons", { recursive: true });

    // Read the SVG file
    const svgBuffer = await fs.readFile("./src/icons/icon.svg");

    // Generate each size
    for (const size of sizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(`./src/icons/icon${size}.png`);

      console.log(`Generated ${size}x${size} icon`);
    }

    console.log("Icon generation complete!");
  } catch (error) {
    console.error("Error generating icons:", error);
  }
}

generateIcons();
