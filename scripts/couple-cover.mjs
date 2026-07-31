import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_TARGET_ASPECTS = [2.2, 0.8, 1.5];
const DEFAULT_MAX_DIMENSION = 960;
const DEFAULT_DETECTOR_THRESHOLD = 0.6;

const PYTHON_COMMANDS = [
  ...(process.env.PORTFOLIO_PYTHON
    ? [{ command: process.env.PORTFOLIO_PYTHON, args: [] }]
    : []),
  ...(process.platform === 'win32'
    ? [{ command: 'py', args: ['-3'] }]
    : [{ command: 'python3', args: [] }]),
  { command: 'python', args: [] },
].filter(Boolean);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolvePublicImage(source, publicRoot) {
  const relativePath = String(source || '').replace(/^\/+/, '');
  const resolvedPath = path.resolve(publicRoot, relativePath);
  const publicDirectory = path.resolve(publicRoot);
  const publicPrefix = `${publicDirectory}${path.sep}`;

  if (resolvedPath !== publicDirectory && !resolvedPath.startsWith(publicPrefix)) {
    throw new Error(`Gallery image is outside the public directory: ${source}`);
  }
  return resolvedPath;
}

async function normalizeImages(gallery, publicRoot) {
  const metadataBySource = isObject(gallery.imageMetadata)
    ? gallery.imageMetadata
    : {};
  const normalized = [];

  for (const image of Array.isArray(gallery.images) ? gallery.images : []) {
    const imageValue = isObject(image) ? image : { source: image };
    const source = imageValue.source || imageValue.src;
    if (!source) continue;

    const imagePath = imageValue.path
      ? path.resolve(imageValue.path)
      : resolvePublicImage(source, publicRoot);

    try {
      await fs.access(imagePath);
    } catch {
      continue;
    }

    const metadata = isObject(metadataBySource[source])
      ? metadataBySource[source]
      : {};
    const width = Number(imageValue.width) || Number(metadata.width) || 0;
    const height = Number(imageValue.height) || Number(metadata.height) || 0;

    normalized.push({
      source,
      path: imagePath,
      ...(width > 0 ? { width } : {}),
      ...(height > 0 ? { height } : {}),
    });
  }

  return normalized;
}

async function fileSignature(filePath) {
  const stats = await fs.stat(filePath, { bigint: true });
  return {
    path: path.resolve(filePath),
    size: String(stats.size),
    modified: String(stats.mtimeNs),
  };
}

async function analysisSignature({
  images,
  targetAspects,
  maxDimension,
  detectorThreshold,
  toolSignatures,
}) {
  const imageSignatures = await Promise.all(
    images.map(async image => ({
      source: image.source,
      ...await fileSignature(image.path),
    })),
  );
  const payload = {
    version: 1,
    images: imageSignatures,
    targetAspects,
    maxDimension,
    detectorThreshold,
    tools: toolSignatures,
  };
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function loadSelectionCache(cachePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(cachePath, 'utf8'));
    if (parsed?.version === 1 && isObject(parsed.entries)) return parsed;
  } catch {
    // A missing or stale result cache simply triggers fresh analysis.
  }
  return { version: 1, entries: {} };
}

async function saveSelectionCache(cachePath, cache) {
  const temporaryPath = path.join(
    path.dirname(cachePath),
    `.selection-cache-${process.pid}-${Date.now()}.tmp`,
  );
  await fs.writeFile(temporaryPath, JSON.stringify(cache), 'utf8');
  await fs.rename(temporaryPath, cachePath);
}

async function runSelector({
  pythonCommands,
  selectorPath,
  detectorPath,
  recognizerPath,
  cacheDirectory,
  manifestPath,
  maxDimension,
  detectorThreshold,
}) {
  let lastError;
  const commandKeys = new Set();
  const commands = pythonCommands
    .map(value => (
      typeof value === 'string'
        ? { command: value, args: [] }
        : value
    ))
    .filter(value => {
      const key = `${value.command}\0${(value.args || []).join('\0')}`;
      if (commandKeys.has(key)) return false;
      commandKeys.add(key);
      return true;
    });

  for (const pythonCommand of commands) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { stdout } = await execFileAsync(
          pythonCommand.command,
          [
            ...(pythonCommand.args || []),
            selectorPath,
            '--manifest',
            manifestPath,
            '--detector',
            detectorPath,
            '--recognizer',
            recognizerPath,
            '--cache-dir',
            cacheDirectory,
            '--max-dimension',
            String(maxDimension),
            '--detector-threshold',
            String(detectorThreshold),
          ],
          {
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
            windowsHide: true,
            env: {
              ...process.env,
              PYTHONFAULTHANDLER: '1',
              PYTHONIOENCODING: 'utf-8',
            },
          },
        );

        const result = JSON.parse(stdout.trim());
        if (!isObject(result)) {
          throw new Error('Couple-cover selector returned an invalid result');
        }
        return result;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error('Python is unavailable');
}

/**
 * Analyze gallery images and return one automatic couple-cover suggestion per
 * gallery. All face embeddings stay in the private on-disk cache; only the
 * selected source, focus metadata, score and diagnostics are returned.
 */
export async function analyzeCoupleCovers(galleries, options = {}) {
  if (!Array.isArray(galleries)) {
    throw new TypeError('analyzeCoupleCovers expects an array of galleries');
  }

  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const publicRoot = path.resolve(options.publicRoot || path.join(projectRoot, 'public'));
  const selectorPath = path.resolve(
    options.selectorPath || path.join(scriptsDirectory, 'select-couple-cover.py'),
  );
  const detectorPath = path.resolve(
    options.detectorPath
      || process.env.PORTFOLIO_YUNET_MODEL
      || path.join(scriptsDirectory, 'models', 'face_detection_yunet_2023mar.onnx'),
  );
  const recognizerPath = path.resolve(
    options.recognizerPath
      || process.env.PORTFOLIO_SFACE_MODEL
      || path.join(scriptsDirectory, 'models', 'face_recognition_sface_2021dec.onnx'),
  );
  const cacheDirectory = path.resolve(
    options.cacheDirectory
      || process.env.PORTFOLIO_COUPLE_CACHE
      || path.join(projectRoot, '.cache', 'couple-cover', 'v1'),
  );
  const maxDimension = Number(options.maxDimension) || DEFAULT_MAX_DIMENSION;
  const detectorThreshold = Number(options.detectorThreshold)
    || DEFAULT_DETECTOR_THRESHOLD;
  const targetAspects = Array.isArray(options.targetAspects)
    ? options.targetAspects
    : DEFAULT_TARGET_ASPECTS;
  const selectionCachePath = path.resolve(
    options.selectionCachePath
      || path.join(cacheDirectory, 'selection-cache.json'),
  );

  await Promise.all([
    fs.access(selectorPath),
    fs.access(detectorPath),
    fs.access(recognizerPath),
    fs.mkdir(cacheDirectory, { recursive: true }),
  ]);
  const toolSignatures = await Promise.all([
    fileSignature(selectorPath),
    fileSignature(detectorPath),
    fileSignature(recognizerPath),
  ]);
  const selectionCache = options.selectionCache === false
    ? { version: 1, entries: {} }
    : await loadSelectionCache(selectionCachePath);
  let selectionCacheChanged = false;

  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'portfolio-couple-cover-'),
  );

  try {
    const results = [];

    for (let index = 0; index < galleries.length; index += 1) {
      const gallery = galleries[index] || {};
      const galleryKey = String(
        gallery.galleryKey || gallery.id || `gallery-${index + 1}`,
      );
      const images = await normalizeImages(gallery, publicRoot);

      if (!images.length) {
        results.push({
          galleryKey,
          version: 1,
          method: 'none',
          confidence: 0,
          coverSource: null,
          coverIndex: -1,
          coverFocus: null,
          stats: {
            images: 0,
            faces: 0,
            cacheHits: 0,
            elapsedMs: 0,
          },
        });
        continue;
      }

      const signature = await analysisSignature({
        images,
        targetAspects,
        maxDimension,
        detectorThreshold,
        toolSignatures,
      });
      const cached = selectionCache.entries[galleryKey];
      if (
        options.selectionCache !== false
        && cached?.signature === signature
        && isObject(cached.result)
      ) {
        results.push({
          galleryKey,
          ...cached.result,
          stats: {
            ...(cached.result.stats || {}),
            resultCacheHit: true,
          },
        });
        continue;
      }

      const manifest = {
        version: 1,
        galleryId: galleryKey,
        images,
        targetAspects,
      };
      const manifestPath = path.join(
        temporaryDirectory,
        `manifest-${String(index + 1).padStart(3, '0')}.json`,
      );
      await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

      const result = await runSelector({
        pythonCommands: options.pythonCommands || PYTHON_COMMANDS,
        selectorPath,
        detectorPath,
        recognizerPath,
        cacheDirectory,
        manifestPath,
        maxDimension,
        detectorThreshold,
      });

      results.push({
        galleryKey,
        ...result,
        stats: {
          ...(result.stats || {}),
          resultCacheHit: false,
        },
      });
      selectionCache.entries[galleryKey] = {
        signature,
        result,
      };
      selectionCacheChanged = true;
    }

    if (options.selectionCache !== false && selectionCacheChanged) {
      await saveSelectionCache(selectionCachePath, selectionCache);
    }
    return results;
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
