const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

const SOURCE_DIR = path.join(__dirname, 'assets', 'images', 'posters');
const OUTPUT_DIR = path.join(__dirname, 'assets', 'images', 'posters-optimized');
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function ensureOutputDirectory() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function isSupportedImage(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(extension);
}

async function optimizeFile(fileName) {
  const sourcePath = path.join(SOURCE_DIR, fileName);
  const outputName = `${path.parse(fileName).name}.webp`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  await sharp(sourcePath)
    .resize({ width: 300, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(outputPath);

  console.log(`Optimized: ${fileName} → ${outputName}`);
}

async function run() {
  try {
    await ensureOutputDirectory();

    const items = await fs.readdir(SOURCE_DIR, { withFileTypes: true });
    const imageFiles = items
      .filter((item) => item.isFile() && isSupportedImage(item.name))
      .map((item) => item.name);

    if (imageFiles.length === 0) {
      console.log('No supported poster images found in', SOURCE_DIR);
      return;
    }

    const tasks = imageFiles.map((fileName) =>
      optimizeFile(fileName).catch((error) => {
        console.error(`Failed to optimize ${fileName}:`, error.message || error);
      })
    );

    await Promise.all(tasks);
    console.log('Poster optimization complete.');
  } catch (error) {
    console.error('Error during poster optimization:', error.message || error);
    process.exitCode = 1;
  }
}

run();
