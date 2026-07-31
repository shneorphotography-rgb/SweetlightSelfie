import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const detectorPath = path.join(scriptsDirectory, 'detect-cover-focus.py');
const modelPath = path.join(
  scriptsDirectory,
  'models',
  'face_detection_yunet_2023mar.onnx',
);

const PYTHON_COMMANDS = [
  process.env.PORTFOLIO_PYTHON,
  process.platform === 'win32' ? 'python' : 'python3',
  'python',
].filter(Boolean);

function round(value) {
  return Math.round(value * 1000) / 1000;
}

async function detectWithPython(imagePaths) {
  await Promise.all([fs.access(detectorPath), fs.access(modelPath)]);

  let lastError;
  for (const command of [...new Set(PYTHON_COMMANDS)]) {
    try {
      const { stdout } = await execFileAsync(
        command,
        [
          detectorPath,
          '--model',
          modelPath,
          ...imagePaths,
        ],
        {
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
          windowsHide: true,
          env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8',
          },
        },
      );
      return JSON.parse(stdout);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Python is unavailable');
}

async function detectAttentionFocus(imagePath) {
  const metadata = await sharp(imagePath).rotate().metadata();
  const width = metadata.autoOrient?.width || metadata.width || 0;
  const height = metadata.autoOrient?.height || metadata.height || 0;

  if (!width || !height) {
    return {
      path: imagePath,
      method: 'none',
      width,
      height,
      faceCount: 0,
    };
  }

  const { info } = await sharp(imagePath)
    .rotate()
    .resize({
      width: 1200,
      height: 630,
      fit: 'cover',
      position: sharp.strategy.attention,
      withoutEnlargement: true,
    })
    .webp({ quality: 60 })
    .toBuffer({ resolveWithObject: true });

  const attentionX = Number.isFinite(info.attentionX) ? info.attentionX : width / 2;
  const attentionY = Number.isFinite(info.attentionY) ? info.attentionY : height / 2;

  return {
    path: imagePath,
    method: 'attention',
    width,
    height,
    faceCount: 0,
    x: round(attentionX / width * 100),
    y: round(attentionY / height * 100),
  };
}

export function toCoverFocus(result, publicSource) {
  if (!result || !Number.isFinite(result.x) || !Number.isFinite(result.y)) {
    return null;
  }

  const focus = {
    source: publicSource,
    method: result.method,
    x: result.x,
    y: result.y,
    width: result.width,
    height: result.height,
    faceCount: result.faceCount || 0,
  };

  if (result.safeArea) focus.safeArea = result.safeArea;
  return focus;
}

export async function detectCoverFocuses(imagePaths) {
  const resolvedPaths = imagePaths.map(imagePath => path.resolve(imagePath));
  let detected = [];

  try {
    detected = await detectWithPython(resolvedPaths);
  } catch (error) {
    console.warn(
      `[cover-focus] Face detection unavailable; using visual attention fallback: ${error.message}`,
    );
  }

  const detectionsByPath = new Map(
    detected.map(result => [path.resolve(result.path), result]),
  );

  return Promise.all(resolvedPaths.map(async imagePath => {
    const result = detectionsByPath.get(imagePath);
    if (result?.method === 'faces') return result;
    try {
      return await detectAttentionFocus(imagePath);
    } catch (error) {
      console.warn(`[cover-focus] Could not analyze ${imagePath}: ${error.message}`);
      return {
        path: imagePath,
        method: 'none',
        width: 0,
        height: 0,
        faceCount: 0,
      };
    }
  }));
}
