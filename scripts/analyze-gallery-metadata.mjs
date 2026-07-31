import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, 'public');
const configPath = path.join(projectRoot, 'src', 'data', 'config.json');
const CONCURRENCY = 16;

function resolvePublicImage(publicUrl) {
  const relativePath = String(publicUrl || '').replace(/^\/+/, '');
  const resolvedPath = path.resolve(publicRoot, relativePath);
  const publicPrefix = `${path.resolve(publicRoot)}${path.sep}`;

  if (!resolvedPath.startsWith(publicPrefix)) {
    throw new Error(`Gallery image is outside the public directory: ${publicUrl}`);
  }
  return resolvedPath;
}

async function mapWithConcurrency(values, callback) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(values[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(CONCURRENCY, values.length) },
      () => worker(),
    ),
  );
  return results;
}

async function readSize(publicUrl) {
  const metadata = await sharp(resolvePublicImage(publicUrl)).metadata();
  const width = metadata.autoOrient?.width || metadata.width || 0;
  const height = metadata.autoOrient?.height || metadata.height || 0;
  return { width, height };
}

async function main() {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const galleryItems = Array.isArray(config.galleryItems) ? config.galleryItems : [];
  const allImages = galleryItems.flatMap(item => item.images || []);
  const uniqueImages = [...new Set(allImages)];
  const sizes = await mapWithConcurrency(uniqueImages, readSize);
  const sizeBySource = new Map(
    uniqueImages.map((src, index) => [src, sizes[index]]),
  );

  config.galleryItems = galleryItems.map(item => ({
    ...item,
    imageMetadata: Object.fromEntries(
      (item.images || []).map(src => [src, sizeBySource.get(src)]),
    ),
  }));

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(`Updated layout metadata for ${uniqueImages.length} gallery images.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
