import fs from 'node:fs/promises';
import path from 'node:path';
import { analyzeCoupleCovers } from './couple-cover.mjs';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'src', 'data', 'config.json');

function printHelp() {
  console.log(`Usage: node scripts/analyze-couple-covers.mjs [--force]

Selects a couple-focused automatic cover for every gallery.

  --force  Reset explicit and legacy manual covers to the automatic selection.
  --help   Show this help.`);
}

function parseArguments(values) {
  const supported = new Set(['--force', '--help']);
  const unknown = values.filter(value => !supported.has(value));
  if (unknown.length) {
    throw new Error(`Unknown option: ${unknown.join(', ')}`);
  }

  return {
    force: values.includes('--force'),
    help: values.includes('--help'),
  };
}

function deriveGalleryKey(item, index) {
  if (item.galleryKey) return String(item.galleryKey);

  const candidates = [
    item.coverImage,
    ...(Array.isArray(item.images) ? item.images.slice(0, 1) : []),
  ];

  for (const source of candidates) {
    const match = String(source || '').match(
      /^\/portfolio-media\/gallery\/([^/]+)\/[^/]+\//,
    );
    if (match) {
      const title = String(item.title || item.id || index + 1).trim();
      return `${match[1]}/${title}`;
    }
  }

  return `gallery/${String(item.id || index + 1)}`;
}

function uniqueSources(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function focusForSource(focus, source) {
  return focus?.source === source ? focus : null;
}

function getAspectRatio(item, source, focus) {
  const metadata = item.imageMetadata?.[source];
  const width = Number(focus?.width) || Number(metadata?.width) || 0;
  const height = Number(focus?.height) || Number(metadata?.height) || 0;

  if (width > 0 && height > 0) {
    return height > width ? '2:3' : '3:2';
  }
  return item.aspectRatio || '3:2';
}

function buildAutoCover(item, analysis) {
  const images = Array.isArray(item.images) ? item.images : [];
  const previousAuto = item.autoCover || {};
  const legacyAutoImage = (
    item.coverMode !== 'manual' && images.includes(item.coverImage)
  )
    ? item.coverImage
    : null;
  const source = analysis?.coverSource
    || previousAuto.image
    || legacyAutoImage
    || images[0]
    || item.coverImage
    || '';
  const focus = focusForSource(analysis?.coverFocus, source)
    || focusForSource(previousAuto.focus, source)
    || focusForSource(item.coverFocus, source);
  const previousImages = uniqueSources([
    ...(Array.isArray(previousAuto.previousImages)
      ? previousAuto.previousImages
      : []),
    previousAuto.image,
    legacyAutoImage,
  ]).filter(previousImage => previousImage !== source);

  return {
    image: source,
    ...(focus ? { focus } : {}),
    score: Number.isFinite(analysis?.confidence) ? analysis.confidence : 0,
    algorithm: analysis?.method || previousAuto.algorithm || 'none',
    version: analysis?.version || previousAuto.version || 1,
    previousImages,
  };
}

function applyAnalysis(item, analysis, { force }) {
  const images = Array.isArray(item.images) ? item.images : [];
  const isExplicitManual = item.coverMode === 'manual';
  const isLegacyExternalManual = (
    !item.coverMode
    && Boolean(item.coverImage)
    && !images.includes(item.coverImage)
  );
  const preserveManual = !force && (isExplicitManual || isLegacyExternalManual);
  const autoCover = buildAutoCover(item, analysis);

  if (preserveManual || !autoCover.image) {
    return {
      ...item,
      coverMode: preserveManual ? 'manual' : (item.coverMode || 'auto'),
      autoCover,
    };
  }

  const sameFrameSource = (
    !force
    && item.coverImage === autoCover.image
    && (!item.coverFrameSource || item.coverFrameSource === autoCover.image)
  );
  const {
    coverX,
    coverY,
    coverZoom,
    coverFrameSource,
    ...itemWithoutFrame
  } = item;

  return {
    ...itemWithoutFrame,
    ...(sameFrameSource && Number.isFinite(coverX) ? { coverX } : {}),
    ...(sameFrameSource && Number.isFinite(coverY) ? { coverY } : {}),
    ...(sameFrameSource && Number.isFinite(coverZoom) ? { coverZoom } : {}),
    ...(sameFrameSource && coverFrameSource ? { coverFrameSource } : {}),
    galleryKey: analysis.galleryKey,
    coverMode: 'auto',
    autoCover,
    coverImage: autoCover.image,
    ...(autoCover.focus ? { coverFocus: autoCover.focus } : {}),
    ...(!autoCover.focus ? { coverFocus: undefined } : {}),
    aspectRatio: getAspectRatio(item, autoCover.image, autoCover.focus),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const galleryItems = Array.isArray(config.galleryItems)
    ? config.galleryItems
    : [];
  const galleries = galleryItems.map((item, index) => ({
    ...item,
    galleryKey: deriveGalleryKey(item, index),
  }));

  const analyses = await analyzeCoupleCovers(galleries, { projectRoot });
  const analysesByKey = new Map(
    analyses.map(analysis => [analysis.galleryKey, analysis]),
  );

  config.galleryItems = galleries.map(item => applyAnalysis(
    item,
    analysesByKey.get(item.galleryKey),
    options,
  ));

  await fs.writeFile(
    configPath,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );

  const automaticCount = config.galleryItems.filter(
    item => item.coverMode === 'auto',
  ).length;
  const manualCount = config.galleryItems.length - automaticCount;
  console.log(
    `Updated ${config.galleryItems.length} galleries: `
    + `${automaticCount} automatic, ${manualCount} manual.`,
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
