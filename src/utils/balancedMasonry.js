const MIN_RATIO = 0.25;
const MAX_RATIO = 4;
const OPTIMIZED_TAIL_SIZE = 9;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getBalancedColumnCount(viewportWidth) {
  if (viewportWidth < 480) return 1;
  if (viewportWidth < 1200) return 2;
  return 3;
}

export function getBalancedGalleryGap(viewportWidth) {
  if (viewportWidth < 480) return 12;
  if (viewportWidth < 768) return 10.4;
  return clamp(viewportWidth * 0.0145, 12, 22.4);
}

export function getImageHeightRatio(src, metadata, measuredRatios, fallback = 1) {
  const size = metadata?.[src];
  if (Number.isFinite(size?.width) && Number.isFinite(size?.height) && size.width > 0) {
    return clamp(size.height / size.width, MIN_RATIO, MAX_RATIO);
  }

  const measured = measuredRatios?.[src];
  if (Number.isFinite(measured) && measured > 0) {
    return clamp(measured, MIN_RATIO, MAX_RATIO);
  }

  return clamp(fallback, MIN_RATIO, MAX_RATIO);
}

export function buildBalancedMasonry({
  images,
  containerWidth,
  columnCount,
  gap,
  getRatio,
  optimizeTail = false,
}) {
  if (!images.length || containerWidth <= 0 || columnCount <= 0) {
    return { items: [], height: 0, columnHeights: [] };
  }

  const safeColumnCount = Math.min(columnCount, images.length);
  const columnWidth = (
    containerWidth - gap * (safeColumnCount - 1)
  ) / safeColumnCount;
  const columnHeights = Array(safeColumnCount).fill(0);
  const ratios = images.map((src, index) => getRatio(src, index));
  const tailStart = optimizeTail && safeColumnCount > 1
    ? Math.min(
        images.length,
        Math.max(safeColumnCount * 2, images.length - OPTIMIZED_TAIL_SIZE),
      )
    : images.length;
  const columnAssignments = [];

  for (let index = 0; index < tailStart; index += 1) {
    const shortestHeight = Math.min(...columnHeights);
    const column = columnHeights.indexOf(shortestHeight);
    const height = columnWidth * ratios[index];
    columnAssignments[index] = column;
    columnHeights[column] += height + gap;
  }

  if (tailStart < images.length) {
    let bestAssignments = null;
    let bestSpread = Number.POSITIVE_INFINITY;
    const workingAssignments = [];
    const workingHeights = [...columnHeights];

    const search = (tailIndex) => {
      if (tailStart + tailIndex >= images.length) {
        const spread = Math.max(...workingHeights) - Math.min(...workingHeights);
        if (spread < bestSpread) {
          bestSpread = spread;
          bestAssignments = [...workingAssignments];
        }
        return;
      }

      const imageIndex = tailStart + tailIndex;
      const height = columnWidth * ratios[imageIndex] + gap;
      const visitedHeights = new Set();

      for (let column = 0; column < safeColumnCount; column += 1) {
        const heightKey = Math.round(workingHeights[column] * 100) / 100;
        if (visitedHeights.has(heightKey)) continue;
        visitedHeights.add(heightKey);

        workingAssignments[tailIndex] = column;
        workingHeights[column] += height;
        search(tailIndex + 1);
        workingHeights[column] -= height;
      }
    };

    search(0);
    bestAssignments?.forEach((column, tailIndex) => {
      const imageIndex = tailStart + tailIndex;
      columnAssignments[imageIndex] = column;
      columnHeights[column] += columnWidth * ratios[imageIndex] + gap;
    });
  }

  columnHeights.fill(0);
  const items = images.map((src, index) => {
    const column = columnAssignments[index];
    const height = columnWidth * ratios[index];
    const x = column * (columnWidth + gap);
    const y = columnHeights[column];

    columnHeights[column] += height + gap;

    return {
      src,
      index,
      column,
      x,
      y,
      width: columnWidth,
      height,
    };
  });

  return {
    items,
    height: Math.max(...columnHeights) - gap,
    columnHeights: columnHeights.map(value => value - gap),
  };
}
