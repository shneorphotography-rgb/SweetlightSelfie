import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { analyzeCoupleCovers } from './couple-cover.mjs';
import { detectCoverFocuses, toCoverFocus } from './cover-focus.mjs';

const projectRoot = process.cwd();
const sourceRoot = path.resolve(projectRoot, '..', 'omershneor');
const publicRoot = path.resolve(projectRoot, 'public');
const mediaRoot = path.join(publicRoot, 'portfolio-media');
const configPath = path.resolve(projectRoot, 'src', 'data', 'config.json');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const collator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });

const categoryDefs = [
  { source: 'חתונות ערב', label: 'חתונות ערב', key: 'evening-weddings', descriptionPrefix: 'חתונת ערב' },
  { source: 'חתונות צהריים', label: 'חתונות צהריים', key: 'day-weddings', descriptionPrefix: 'חתונת צהריים' },
  { source: 'צילומי זוגיות', label: 'צילומי זוגיות', key: 'couples', descriptionPrefix: 'צילומי זוגיות' }
];

function sortNaturally(values) {
  return [...values].sort((a, b) => collator.compare(a, b));
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function collectImageFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of sortNaturally(entries.map((item) => item.name))) {
    const fullPath = path.join(dirPath, entry);
    const stats = await fs.lstat(fullPath);

    if (stats.isSymbolicLink()) {
      continue;
    }

    if (stats.isDirectory()) {
      files.push(...await collectImageFiles(fullPath));
      continue;
    }

    if (IMAGE_EXTENSIONS.has(path.extname(entry).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function findFirstImageInDir(dirPath) {
  const files = await collectImageFiles(dirPath);
  return files[0] || null;
}

function toPublicUrl(filePath) {
  return `/${path.relative(publicRoot, filePath).split(path.sep).join('/')}`;
}

function galleryIdentity(item) {
  return `${String(item?.category || '').trim()}\u0000${String(item?.title || '').trim()}`;
}

function isManualCover(item) {
  if (!item?.coverImage) return false;
  if (item.coverMode === 'manual') return true;
  if (item.coverMode === 'auto') return false;
  return !Array.isArray(item.images) || !item.images.includes(item.coverImage);
}

function resolvePublicSource(source) {
  if (!source || /^[a-z]+:/i.test(source) || String(source).startsWith('//')) {
    return null;
  }

  const resolvedPath = path.resolve(publicRoot, String(source).replace(/^\/+/, ''));
  const publicPrefix = `${path.resolve(publicRoot)}${path.sep}`;
  if (resolvedPath !== path.resolve(publicRoot) && !resolvedPath.startsWith(publicPrefix)) {
    return null;
  }
  return resolvedPath;
}

function isWithinDirectory(filePath, directory) {
  const resolvedFile = path.resolve(filePath);
  const resolvedDirectory = path.resolve(directory);
  return (
    resolvedFile === resolvedDirectory
    || resolvedFile.startsWith(`${resolvedDirectory}${path.sep}`)
  );
}

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function preserveManualCoverFiles(items) {
  const preserved = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    if (!isManualCover(item) || preserved.has(item.coverImage)) continue;
    const filePath = resolvePublicSource(item.coverImage);
    if (!filePath || !isWithinDirectory(filePath, mediaRoot)) continue;

    try {
      preserved.set(item.coverImage, await fs.readFile(filePath));
    } catch {
      // A stale manual path should not block regeneration.
    }
  }

  return preserved;
}

async function restoreManualCoverFiles(preserved) {
  for (const [source, contents] of preserved) {
    const filePath = resolvePublicSource(source);
    if (!filePath) continue;
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, contents);
  }
}

function selectLandscapeFallback(imageUrls, imageMetadata) {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const targetAspect = 2.2;

  imageMetadata.forEach((metadata, index) => {
    const width = Number(metadata?.width) || 0;
    const height = Number(metadata?.height) || 0;
    if (width <= height || height <= 0) return;

    const distance = Math.abs(Math.log((width / height) / targetAspect));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return imageUrls[bestIndex >= 0 ? bestIndex : 0] || '';
}

function getSourceDimensions(item, source, focus) {
  const metadata = item.imageMetadata?.[source];
  return {
    width: Number(focus?.width) || Number(metadata?.width) || 0,
    height: Number(focus?.height) || Number(metadata?.height) || 0,
  };
}

function aspectRatioForSource(item, source, focus, fallback = '3:2') {
  const { width, height } = getSourceDimensions(item, source, focus);
  if (width > 0 && height > 0) return height > width ? '2:3' : '3:2';
  return fallback;
}

function uniqueSources(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

async function processImage(inputPath, outputPath, options) {
  const metadata = await sharp(inputPath).rotate().metadata();
  let pipeline = sharp(inputPath).rotate();

  if (options.mode === 'square') {
    pipeline = pipeline.resize({
      width: options.size,
      height: options.size,
      fit: 'cover',
      position: 'attention'
    });
  } else {
    pipeline = pipeline.resize({
      width: options.maxDimension,
      height: options.maxDimension,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  await ensureDir(path.dirname(outputPath));
  const outputInfo = await pipeline.webp({
    quality: options.quality,
    effort: 5
  }).toFile(outputPath);

  return {
    width: outputInfo.width || metadata.autoOrient?.width || metadata.width || 0,
    height: outputInfo.height || metadata.autoOrient?.height || metadata.height || 0
  };
}

function buildReviewFallback(name) {
  return {
    name,
    text: 'החוויה הייתה טבעית, רגועה ומדויקת. התמונות יצאו מלאות רגש ואור, בדיוק כמו שקיווינו.',
    rating: 5,
    image: ''
  };
}

async function main() {
  try {
    await fs.access(sourceRoot);
  } catch {
    throw new Error(`Source images folder not found: ${sourceRoot}`);
  }

  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const existingGalleryItems = Array.isArray(config.galleryItems)
    ? config.galleryItems
    : [];
  const existingByGalleryKey = new Map(
    existingGalleryItems
      .filter(item => item.galleryKey)
      .map(item => [String(item.galleryKey), item]),
  );
  const existingByIdentity = new Map(
    existingGalleryItems.map(item => [galleryIdentity(item), item]),
  );
  const preservedManualFiles = await preserveManualCoverFiles(existingGalleryItems);

  await fs.rm(mediaRoot, { recursive: true, force: true });
  await ensureDir(mediaRoot);

  let galleryItems = [];
  const sessionRecords = [];
  let galleryId = 1;
  let firstSourceImage = null;
  let anyPortraitSource = null;
  let couplesPortraitSource = null;

  for (const category of categoryDefs) {
    const categoryDir = path.join(sourceRoot, category.source);
    const sessionDirs = sortNaturally(
      (await fs.readdir(categoryDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    );

    for (let index = 0; index < sessionDirs.length; index += 1) {
      const sessionName = sessionDirs[index];
      const sourceSessionDir = path.join(categoryDir, sessionName);
      const sessionFiles = await collectImageFiles(sourceSessionDir);

      if (!sessionFiles.length) {
        continue;
      }

      const sessionSlug = `${String(index + 1).padStart(2, '0')}`;
      const sessionOutputDir = path.join(mediaRoot, 'gallery', category.key, sessionSlug);
      const coverSource = sessionFiles[0];
      const coverOutput = path.join(sessionOutputDir, 'cover.webp');
      const coverMeta = await processImage(coverSource, coverOutput, {
        maxDimension: 1600,
        quality: 82
      });

      const imageUrls = [];
      const imageMetadata = [];

      for (let imageIndex = 0; imageIndex < sessionFiles.length; imageIndex += 1) {
        const sourceFile = sessionFiles[imageIndex];
        const fileName = `${String(imageIndex + 1).padStart(3, '0')}.webp`;
        const outputPath = path.join(sessionOutputDir, 'images', fileName);
        const metadata = await processImage(sourceFile, outputPath, {
          maxDimension: 2200,
          quality: 80
        });

        firstSourceImage ||= sourceFile;

        if (metadata.height > metadata.width) {
          anyPortraitSource ||= sourceFile;
          if (category.key === 'couples') {
            couplesPortraitSource ||= sourceFile;
          }
        }

        imageUrls.push(toPublicUrl(outputPath));
        imageMetadata.push(metadata);
      }

      const coverUrl = toPublicUrl(coverOutput);
      // The source folder name is stable even if galleries are reordered;
      // the numeric output folder is not.
      const galleryKey = `${category.key}/${sessionName}`;
      const selectedCoverImage = (
        selectLandscapeFallback(imageUrls, imageMetadata)
        || imageUrls[0]
        || coverUrl
      );
      const selectedCoverIndex = Math.max(0, imageUrls.indexOf(selectedCoverImage));
      const selectedCoverMeta = imageMetadata[selectedCoverIndex] || coverMeta;

      galleryItems.push({
        id: galleryId,
        galleryKey,
        title: sessionName,
        category: category.label,
        coverImage: selectedCoverImage,
        coverMode: 'auto',
        coverPosition: 'center center',
        description: `${category.descriptionPrefix} של ${sessionName}`,
        images: imageUrls,
        imageMetadata: Object.fromEntries(
          imageUrls.map((src, imageIndex) => [src, imageMetadata[imageIndex]])
        ),
        aspectRatio: selectedCoverMeta.height > selectedCoverMeta.width ? '2:3' : '3:2'
      });

      sessionRecords.push({
        id: galleryId,
        name: sessionName,
        category: category.label,
        coverSource
      });

      galleryId += 1;
    }
  }

  await restoreManualCoverFiles(preservedManualFiles);

  let coupleAnalyses = [];
  try {
    coupleAnalyses = await analyzeCoupleCovers(galleryItems, {
      projectRoot,
      publicRoot,
    });
  } catch (error) {
    console.warn(
      `[couple-cover] Automatic couple selection unavailable; `
      + `using landscape fallbacks: ${error.message}`,
    );
  }

  const analysesByKey = new Map(
    coupleAnalyses.map(analysis => [String(analysis.galleryKey), analysis]),
  );

  const selectedGalleryItems = [];
  for (const item of galleryItems) {
    const existingItem = (
      existingByGalleryKey.get(item.galleryKey)
      || existingByIdentity.get(galleryIdentity(item))
    );
    const analysis = analysesByKey.get(item.galleryKey);
    const analyzedSource = item.images.includes(analysis?.coverSource)
      ? analysis.coverSource
      : '';
    const autoSource = analyzedSource || item.coverImage || item.images[0] || '';
    const analysisFocus = (
      analysis?.coverFocus?.source === autoSource
        ? analysis.coverFocus
        : null
    );
    const previousAuto = existingItem?.autoCover || {};
    const previousAutomaticImage = (
      existingItem
      && !isManualCover(existingItem)
      && item.images.includes(existingItem.coverImage)
    )
      ? existingItem.coverImage
      : '';
    const autoCover = {
      image: autoSource,
      ...(analysisFocus ? { focus: analysisFocus } : {}),
      score: Number.isFinite(analysis?.confidence) ? analysis.confidence : 0,
      algorithm: analyzedSource
        ? (analysis?.method || 'couple-sface')
        : 'landscape-fallback',
      version: analysis?.version || 1,
      previousImages: uniqueSources([
        ...(Array.isArray(previousAuto.previousImages)
          ? previousAuto.previousImages
          : []),
        previousAuto.image,
        previousAutomaticImage,
      ]),
    };

    const manualSource = isManualCover(existingItem)
      ? existingItem.coverImage
      : '';
    const manualPath = resolvePublicSource(manualSource);
    const manualSourceAvailable = Boolean(manualSource) && (
      manualPath
        ? await fileExists(manualPath)
        : /^(https?:|data:)/i.test(manualSource)
    );

    if (manualSourceAvailable) {
      const manualFocus = existingItem.coverFocus?.source === manualSource
        ? existingItem.coverFocus
        : null;
      const manualItem = {
        ...item,
        coverMode: 'manual',
        autoCover,
        coverImage: manualSource,
        coverPosition: existingItem.coverPosition || 'center center',
        ...(manualFocus ? { coverFocus: manualFocus } : {}),
        aspectRatio: aspectRatioForSource(
          item,
          manualSource,
          manualFocus,
          existingItem.aspectRatio || item.aspectRatio,
        ),
      };

      for (const frameKey of ['coverX', 'coverY', 'coverZoom', 'coverFrameSource']) {
        if (existingItem[frameKey] !== undefined) {
          manualItem[frameKey] = existingItem[frameKey];
        }
      }

      selectedGalleryItems.push(manualItem);
      continue;
    }

    selectedGalleryItems.push({
      ...item,
      coverMode: 'auto',
      autoCover,
      coverImage: autoSource,
      coverPosition: 'center center',
      ...(analysisFocus ? { coverFocus: analysisFocus } : {}),
      aspectRatio: aspectRatioForSource(
        item,
        autoSource,
        analysisFocus,
        item.aspectRatio,
      ),
    });
  }
  galleryItems = selectedGalleryItems;

  const missingFocusEntries = galleryItems
    .filter(item => item.coverImage && item.coverFocus?.source !== item.coverImage)
    .map(item => ({ item, filePath: resolvePublicSource(item.coverImage) }))
    .filter(entry => entry.filePath);
  if (missingFocusEntries.length) {
    const focusPaths = missingFocusEntries.map(entry => entry.filePath);
    const coverDetections = await detectCoverFocuses(focusPaths);

    missingFocusEntries.forEach(({ item }, index) => {
      const coverFocus = toCoverFocus(coverDetections[index], item.coverImage);
      if (!coverFocus) return;
      item.coverFocus = coverFocus;
      item.aspectRatio = aspectRatioForSource(
        item,
        item.coverImage,
        coverFocus,
        item.aspectRatio,
      );
      if (item.coverMode === 'auto') {
        item.autoCover = {
          ...item.autoCover,
          focus: coverFocus,
        };
      }
    });
  }

  const heroSourceDir = path.join(sourceRoot, 'תמונות לקאבר');
  const heroSourceFiles = await collectImageFiles(heroSourceDir);
  const heroImages = [];

  for (let index = 0; index < heroSourceFiles.length; index += 1) {
    const outputPath = path.join(mediaRoot, 'hero', `cover-${String(index + 1).padStart(2, '0')}.webp`);
    await processImage(heroSourceFiles[index], outputPath, {
      maxDimension: 3200,
      quality: 88
    });
    heroImages.push(toPublicUrl(outputPath));
  }

  const aboutSourceDir = path.join(sourceRoot, 'תמונה לעל עצמי');
  const explicitAboutSource = await findFirstImageInDir(aboutSourceDir);
  const aboutSource = explicitAboutSource || couplesPortraitSource || anyPortraitSource || firstSourceImage;
  const aboutOutput = path.join(mediaRoot, 'about', 'about.webp');
  await processImage(aboutSource, aboutOutput, {
    maxDimension: 1800,
    quality: 84
  });
  const aboutImage = toPublicUrl(aboutOutput);

  const reviewCandidates = [
    sessionRecords.find((record) => record.category === 'חתונות ערב'),
    sessionRecords.find((record) => record.category === 'חתונות צהריים'),
    sessionRecords.find((record) => record.category === 'צילומי זוגיות')
  ].filter(Boolean);

  const avatarUrls = [];
  for (let index = 0; index < reviewCandidates.length; index += 1) {
    const outputPath = path.join(mediaRoot, 'avatars', `review-${String(index + 1).padStart(2, '0')}.webp`);
    await processImage(reviewCandidates[index].coverSource, outputPath, {
      mode: 'square',
      size: 280,
      quality: 78
    });
    avatarUrls.push(toPublicUrl(outputPath));
  }

  const existingReviews = Array.isArray(config.sections?.testimonials?.reviews)
    ? config.sections.testimonials.reviews
    : [];

  const reviewNames = reviewCandidates.map((candidate) => candidate.name);
  const reviewTexts = existingReviews.length
    ? existingReviews.map((review) => review.text)
    : reviewNames.map((name) => buildReviewFallback(name).text);

  config.photographer.profileImage = aboutImage;
  config.sections.hero.backgroundImage = heroImages[0] || aboutImage;
  config.sections.hero.images = heroImages;
  config.sections.about.image = aboutImage;
  config.sections.testimonials.reviews = reviewNames.map((name, index) => ({
    name,
    text: reviewTexts[index] || buildReviewFallback(name).text,
    rating: 5,
    image: avatarUrls[index] || aboutImage
  }));
  config.galleryItems = galleryItems;
  config.categories = ['הכל', ...categoryDefs.map((category) => category.label)];

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  console.log(`Synced ${galleryItems.length} gallery projects.`);
  console.log(`Processed ${galleryItems.reduce((sum, item) => sum + item.images.length, 0)} gallery images and ${heroImages.length} hero covers.`);
  console.log(`Updated config: ${configPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
