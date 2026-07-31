const KEYWORD_TO_PERCENT = {
  left: 0,
  center: 50,
  right: 100,
  top: 0,
  bottom: 100,
};
const PAN_LIMIT = 50;
export const HERO_PREVIEW_EVENT = 'sweetlight-selfie:hero-preview';
export const HERO_PREVIEW_END_EVENT = 'sweetlight-selfie:hero-preview-end';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toPercent(token, fallback = 50) {
  if (!token) return fallback;
  const normalized = String(token).trim().toLowerCase();
  if (normalized in KEYWORD_TO_PERCENT) return KEYWORD_TO_PERCENT[normalized];
  if (normalized.endsWith('%')) {
    const parsed = Number.parseFloat(normalized.slice(0, -1));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseLegacyPosition(position) {
  if (!position) return { x: 0, y: 0, zoom: 1 };
  const parts = String(position).trim().split(/\s+/);
  const xPercent = toPercent(parts[0], 50);
  const yPercent = toPercent(parts[1], 50);
  return {
    x: clamp(xPercent - 50, -PAN_LIMIT, PAN_LIMIT),
    y: clamp(yPercent - 50, -PAN_LIMIT, PAN_LIMIT),
    zoom: 1,
  };
}

export function normalizeFrame(frame, fallbackPosition) {
  const legacy = parseLegacyPosition(fallbackPosition);
  const next = frame && typeof frame === 'object' ? frame : {};
  return {
    x: clamp(Number.isFinite(next.x) ? next.x : legacy.x, -PAN_LIMIT, PAN_LIMIT),
    y: clamp(Number.isFinite(next.y) ? next.y : legacy.y, -PAN_LIMIT, PAN_LIMIT),
    zoom: clamp(Number.isFinite(next.zoom) ? next.zoom : legacy.zoom, 1, 2.5),
  };
}

export function getImageFrameStyle(frame, fallbackPosition) {
  const normalized = normalizeFrame(frame, fallbackPosition);
  const originX = 50 + normalized.x;
  const originY = 50 + normalized.y;

  return {
    objectPosition: `${originX}% ${originY}%`,
    transform: `scale(${normalized.zoom})`,
    transformOrigin: `${originX}% ${originY}%`,
  };
}

export function hasManualCoverFrame(item) {
  const hasFrame = Boolean(item) && (
    Number.isFinite(item.coverX)
    || Number.isFinite(item.coverY)
    || Number.isFinite(item.coverZoom)
  );

  if (!hasFrame) return false;

  // New edits remember the image they were made for. This prevents a crop
  // tuned for cover A from leaking into a newly selected cover B. Existing
  // saved sites without coverFrameSource keep their legacy framing.
  return !item.coverFrameSource || item.coverFrameSource === item.coverImage;
}

export function getAutomaticCoverFocus(item) {
  const focus = item?.coverFocus;
  if (
    !focus
    || focus.source !== item.coverImage
    || !Number.isFinite(focus.x)
    || !Number.isFinite(focus.y)
  ) {
    return null;
  }
  return focus;
}

export function normalizeCoverFrame(item) {
  if (!item) return normalizeFrame({});

  if (hasManualCoverFrame(item)) {
    return normalizeFrame(
      { x: item.coverX, y: item.coverY, zoom: item.coverZoom },
      item.coverPosition,
    );
  }

  const focus = getAutomaticCoverFocus(item);
  if (focus) {
    return normalizeFrame({
      x: focus.x - 50,
      y: focus.y - 50,
      zoom: 1,
    });
  }

  return normalizeFrame({}, item.coverPosition);
}

export function getCoverFrameStyle(item) {
  return getImageFrameStyle(normalizeCoverFrame(item));
}

function solveSafeCoverAxis({
  start,
  end,
  renderedSize,
  viewportSize,
  safeStart,
  safeEndInset,
  fallback,
}) {
  const overflow = Math.max(0, renderedSize - viewportSize);
  if (overflow < 0.5) return fallback;

  const safeEnd = viewportSize - safeEndInset;
  const requiredMin = (end * renderedSize - safeEnd) / overflow;
  const requiredMax = (start * renderedSize - safeStart) / overflow;
  const preferred = (
    ((start + end) / 2) * renderedSize
    - (safeStart + safeEnd) / 2
  ) / overflow;
  const feasibleMin = Math.max(0, requiredMin);
  const feasibleMax = Math.min(1, requiredMax);

  if (feasibleMin <= feasibleMax) {
    return clamp(preferred, feasibleMin, feasibleMax);
  }
  return clamp(preferred, 0, 1);
}

export function getResponsiveCoverFrameStyle(item, {
  sourceWidth,
  sourceHeight,
  containerWidth,
  containerHeight,
  insets = {},
} = {}) {
  const baseStyle = getCoverFrameStyle(item);
  const focus = getAutomaticCoverFocus(item);
  const bounds = focus?.safeArea;

  if (
    hasManualCoverFrame(item)
    || focus?.method !== 'faces'
    || !bounds
    || !sourceWidth
    || !sourceHeight
    || !containerWidth
    || !containerHeight
  ) {
    return baseStyle;
  }

  const scale = Math.max(
    containerWidth / sourceWidth,
    containerHeight / sourceHeight,
  );
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const fallbackX = clamp(focus.x / 100, 0, 1);
  const fallbackY = clamp(focus.y / 100, 0, 1);
  const left = clamp(bounds.left / 100, 0, 1);
  const top = clamp(bounds.top / 100, 0, 1);
  const right = clamp(bounds.right / 100, left, 1);
  const bottom = clamp(bounds.bottom / 100, top, 1);

  const x = solveSafeCoverAxis({
    start: left,
    end: right,
    renderedSize: renderedWidth,
    viewportSize: containerWidth,
    safeStart: insets.left || 0,
    safeEndInset: insets.right || 0,
    fallback: fallbackX,
  }) * 100;
  const y = solveSafeCoverAxis({
    start: top,
    end: bottom,
    renderedSize: renderedHeight,
    viewportSize: containerHeight,
    safeStart: insets.top || 0,
    safeEndInset: insets.bottom || 0,
    fallback: fallbackY,
  }) * 100;

  return {
    ...baseStyle,
    objectPosition: `${x}% ${y}%`,
    transformOrigin: `${x}% ${y}%`,
  };
}

export function normalizeHeroImage(item, imagePositions = {}) {
  if (typeof item === 'string') {
    const legacyFrame = normalizeFrame({}, imagePositions[item]);
    return {
      src: item,
      ...legacyFrame,
      frames: {
        desktop: legacyFrame,
        mobile: legacyFrame,
      },
      frameMode: {
        desktop: 'free',
        mobile: 'free',
      },
    };
  }

  if (!item || typeof item !== 'object') {
    const emptyFrame = normalizeFrame({});
    return {
      src: '',
      ...emptyFrame,
      frames: { desktop: emptyFrame, mobile: emptyFrame },
      frameMode: { desktop: 'free', mobile: 'free' },
    };
  }

  const src = item.src || '';
  const legacyFrame = normalizeFrame(item, item.position || imagePositions[src]);
  const desktopFrame = normalizeFrame(
    item.frames?.desktop || item.desktopFrame || legacyFrame,
  );
  const mobileFrame = normalizeFrame(
    item.frames?.mobile || item.mobileFrame || legacyFrame,
  );
  const legacyMode = item.frameMode === 'recommended' || item.frameMode === 'free'
    ? item.frameMode
    : 'free';

  return {
    ...item,
    src,
    ...desktopFrame,
    frames: {
      desktop: desktopFrame,
      mobile: mobileFrame,
    },
    frameMode: {
      desktop: item.frameMode?.desktop || legacyMode,
      mobile: item.frameMode?.mobile || legacyMode,
    },
  };
}

export function getRecommendedHeroFrame(item) {
  const focus = item?.coverFocus;
  if (
    !focus
    || (focus.source && focus.source !== item?.src)
    || !Number.isFinite(focus.x)
    || !Number.isFinite(focus.y)
  ) {
    return normalizeFrame({});
  }

  return normalizeFrame({
    x: focus.x - 50,
    y: focus.y - 50,
    zoom: 1,
  });
}

export function hasRecommendedHeroFrame(item) {
  const focus = item?.coverFocus;
  return Boolean(
    focus
    && (!focus.source || focus.source === item?.src)
    && Number.isFinite(focus.x)
    && Number.isFinite(focus.y),
  );
}

export function getHeroFrame(item, variant = 'desktop') {
  const normalized = normalizeHeroImage(item);
  if (
    normalized.frameMode?.[variant] === 'recommended'
    && hasRecommendedHeroFrame(normalized)
  ) {
    return getRecommendedHeroFrame(normalized);
  }
  return normalizeFrame(normalized.frames?.[variant] || normalized);
}

export function getHeroFrameStyle(item, variant = 'desktop') {
  const style = getImageFrameStyle(getHeroFrame(item, variant));
  return {
    ...style,
    '--ssf-frame-transform': style.transform,
  };
}

export function updateFrameValue(frame, patch) {
  return normalizeFrame({ ...normalizeFrame(frame), ...patch });
}
