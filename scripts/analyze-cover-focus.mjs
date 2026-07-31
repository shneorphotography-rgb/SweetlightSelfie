import fs from 'node:fs/promises';
import path from 'node:path';
import { detectCoverFocuses, toCoverFocus } from './cover-focus.mjs';

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, 'public');
const configPath = path.join(projectRoot, 'src', 'data', 'config.json');

function resolvePublicImage(publicUrl) {
  const relativePath = String(publicUrl || '').replace(/^\/+/, '');
  const resolvedPath = path.resolve(publicRoot, relativePath);
  const publicPrefix = `${path.resolve(publicRoot)}${path.sep}`;

  if (!resolvedPath.startsWith(publicPrefix)) {
    throw new Error(`Cover image is outside the public directory: ${publicUrl}`);
  }
  return resolvedPath;
}

async function main() {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const galleryItems = Array.isArray(config.galleryItems) ? config.galleryItems : [];
  const imagePaths = galleryItems.map(item => resolvePublicImage(item.coverImage));
  const detections = await detectCoverFocuses(imagePaths);

  config.galleryItems = galleryItems.map((item, index) => {
    const coverFocus = toCoverFocus(detections[index], item.coverImage);
    if (!coverFocus) return item;
    return { ...item, coverFocus };
  });

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  const faceCount = detections.filter(result => result.method === 'faces').length;
  const fallbackCount = detections.length - faceCount;
  console.log(`Updated ${detections.length} covers (${faceCount} face-aware, ${fallbackCount} attention fallback).`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
