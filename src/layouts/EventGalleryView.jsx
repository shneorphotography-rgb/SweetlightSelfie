import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Lightbox from './Lightbox';
import {
  getCoverFrameStyle,
  getResponsiveCoverFrameStyle,
} from '../utils/imageFrame';
import {
  buildBalancedMasonry,
  getBalancedColumnCount,
  getBalancedGalleryGap,
  getImageHeightRatio,
} from '../utils/balancedMasonry';

const OPENING_TRANSITION_MS = 640;
const INITIAL_IMAGE_COUNT = 18;
const IMAGE_BATCH_SIZE = 18;

function toPlainRect(rect) {
  if (!rect) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export default function EventGalleryView({
  item,
  originRect,
  onClose,
  typography,
}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [lightbox, setLightbox] = useState(null);
  const [openingVisible, setOpeningVisible] = useState(Boolean(originRect) && !reduceMotion);
  const [openingExpanded, setOpeningExpanded] = useState(false);
  const [visibleImageCount, setVisibleImageCount] = useState(
    Math.min(INITIAL_IMAGE_COUNT, item.images.length),
  );
  const closeButtonRef = useRef(null);
  const pageRef = useRef(null);
  const masonryRef = useRef(null);
  const masonryLayoutRef = useRef(null);
  const galleryScrollRef = useRef(null);
  const loadMoreRef = useRef(null);
  const previousFocusRef = useRef(null);
  const heroRef = useRef(null);
  const heroImageRef = useRef(null);
  const pendingRatiosRef = useRef(new Map());
  const ratioFrameRef = useRef(null);
  const [measuredRatios, setMeasuredRatios] = useState({});
  const [masonryMetrics, setMasonryMetrics] = useState({
    width: 0,
    columnCount: getBalancedColumnCount(window.innerWidth),
    gap: getBalancedGalleryGap(window.innerWidth),
  });
  const [heroCoverStyle, setHeroCoverStyle] = useState(
    () => getCoverFrameStyle(item),
  );

  const updateHeroCoverFrame = useCallback(() => {
    const container = heroRef.current;
    const image = heroImageRef.current;
    if (!container || !image) return;

    const nextStyle = getResponsiveCoverFrameStyle(item, {
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
      containerWidth: container.clientWidth,
      containerHeight: container.clientHeight,
      insets: { left: 16, right: 16, top: 16, bottom: 16 },
    });

    setHeroCoverStyle(current => (
      current.objectPosition === nextStyle.objectPosition
      && current.transform === nextStyle.transform
        ? current
        : nextStyle
    ));
  }, [item]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const focusTimer = window.setTimeout(
      () => closeButtonRef.current?.focus(),
      openingVisible ? OPENING_TRANSITION_MS : 0,
    );

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
      document.documentElement.style.overflow = previousHtmlOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (!originRect || reduceMotion) {
      setOpeningVisible(false);
      return undefined;
    }

    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setOpeningExpanded(true));
    });
    const finishTimer = window.setTimeout(
      () => setOpeningVisible(false),
      OPENING_TRANSITION_MS + 80,
    );

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      window.clearTimeout(finishTimer);
    };
  }, [originRect, reduceMotion]);

  useEffect(() => {
    if (lightbox) return undefined;

    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = pageRef.current?.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox, onClose]);

  useEffect(() => {
    setVisibleImageCount(Math.min(INITIAL_IMAGE_COUNT, item.images.length));
    setMeasuredRatios({});
    pendingRatiosRef.current.clear();
  }, [item.id, item.images.length]);

  useLayoutEffect(() => {
    const container = masonryLayoutRef.current;
    if (!container) return undefined;

    const updateMetrics = () => {
      const width = container.clientWidth;
      const viewportWidth = window.innerWidth;
      const nextMetrics = {
        width,
        columnCount: getBalancedColumnCount(viewportWidth),
        gap: getBalancedGalleryGap(viewportWidth),
      };

      setMasonryMetrics(current => (
        Math.abs(current.width - nextMetrics.width) < 0.5
        && current.columnCount === nextMetrics.columnCount
        && current.gap === nextMetrics.gap
          ? current
          : nextMetrics
      ));
    };

    updateMetrics();
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(updateMetrics)
      : null;
    observer?.observe(container);
    window.addEventListener('resize', updateMetrics);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateMetrics);
    };
  }, []);

  useEffect(() => {
    setHeroCoverStyle(getCoverFrameStyle(item));
    const frame = requestAnimationFrame(updateHeroCoverFrame);
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(updateHeroCoverFrame)
      : null;

    if (heroRef.current) observer?.observe(heroRef.current);
    window.addEventListener('resize', updateHeroCoverFrame);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', updateHeroCoverFrame);
    };
  }, [item, updateHeroCoverFrame]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    const scrollRoot = galleryScrollRef.current;
    if (
      masonryMetrics.width <= 0
      || !sentinel
      || !scrollRoot
      || visibleImageCount >= item.images.length
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisibleImageCount(current => Math.min(current + IMAGE_BATCH_SIZE, item.images.length));
      },
      {
        root: scrollRoot,
        rootMargin: '240px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [item.images.length, masonryMetrics.width, visibleImageCount]);

  const openLightbox = (index, element) => {
    setLightbox({
      index,
      originRect: toPlainRect(element.getBoundingClientRect()),
    });
  };

  const openingTargetHeight = window.matchMedia('(max-width: 640px)').matches
    ? '52svh'
    : '58svh';
  const visibleImages = item.images.slice(0, visibleImageCount);
  const hasMoreImages = visibleImageCount < item.images.length;
  const balancedLayout = useMemo(() => buildBalancedMasonry({
    images: visibleImages,
    containerWidth: masonryMetrics.width,
    columnCount: masonryMetrics.columnCount,
    gap: masonryMetrics.gap,
    optimizeTail: !hasMoreImages,
    getRatio: src => getImageHeightRatio(
      src,
      item.imageMetadata,
      measuredRatios,
      1,
    ),
  }), [
    item.imageMetadata,
    masonryMetrics.columnCount,
    masonryMetrics.gap,
    masonryMetrics.width,
    measuredRatios,
    hasMoreImages,
    visibleImages,
  ]);

  const recordImageRatio = useCallback((src, image) => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    if (item.imageMetadata?.[src]) return;

    const ratio = image.naturalHeight / image.naturalWidth;
    if (Math.abs((measuredRatios[src] || 0) - ratio) < 0.001) return;

    pendingRatiosRef.current.set(src, ratio);
    if (ratioFrameRef.current) return;

    ratioFrameRef.current = requestAnimationFrame(() => {
      const pending = Object.fromEntries(pendingRatiosRef.current);
      pendingRatiosRef.current.clear();
      ratioFrameRef.current = null;
      setMeasuredRatios(current => ({ ...current, ...pending }));
    });
  }, [item.imageMetadata, measuredRatios]);

  useEffect(() => () => {
    if (ratioFrameRef.current) cancelAnimationFrame(ratioFrameRef.current);
  }, []);

  return createPortal(
    <div
      ref={pageRef}
      className="event-gallery-page"
      role="dialog"
      aria-modal="true"
      aria-label={`גלריית ${item.title}`}
    >
      <div
        ref={galleryScrollRef}
        className="event-gallery-scroll"
        onScroll={event => {
          const threshold = Math.min(window.innerHeight * 0.42, 420);
          event.currentTarget.parentElement
            ?.querySelector('.event-gallery-toolbar')
            ?.classList.toggle('is-scrolled', event.currentTarget.scrollTop > threshold);
        }}
      >
        <header className="event-gallery-toolbar">
          <button
            ref={closeButtonRef}
            type="button"
            className="event-gallery-back"
            onClick={onClose}
            aria-label="חזרה לעבודות"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
            <span>חזרה לעבודות</span>
          </button>

          <div className="event-gallery-toolbar-title" aria-hidden="true">
            {item.title}
          </div>

          <button
            type="button"
            className="event-gallery-close"
            onClick={onClose}
            aria-label="סגירת הגלריה"
          >
            ✕
          </button>
        </header>

        <section ref={heroRef} className="event-gallery-hero">
          <img
            ref={heroImageRef}
            src={item.coverImage}
            alt=""
            className="event-gallery-hero-image"
            style={heroCoverStyle}
            onLoad={updateHeroCoverFrame}
          />
          <div className="event-gallery-hero-scrim" />
          <div className="event-gallery-hero-content">
            <span
              className="event-gallery-category"
              style={{ fontFamily: typography?.bodyFamily }}
            >
              {item.category}
            </span>
            <h2
              className="event-gallery-title"
              style={{ fontFamily: typography?.headingFamily }}
            >
              {item.title}
            </h2>
            {item.description && (
              <p
                className="event-gallery-description"
                style={{ fontFamily: typography?.bodyFamily }}
              >
                {item.description}
              </p>
            )}
            <button
              type="button"
              className="event-gallery-scroll-cue"
              onClick={() => masonryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <span>{item.images.length} תמונות</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </section>

        <main ref={masonryRef} className="event-gallery-body">
          <div className="event-gallery-intro">
            <span className="event-gallery-intro-kicker">הסיפור המלא</span>
            <h3 style={{ fontFamily: typography?.headingFamily }}>
              רגעים מתוך {item.title}
            </h3>
            <div className="event-gallery-intro-line" />
          </div>

          <div
            ref={masonryLayoutRef}
            className="event-gallery-masonry"
            style={{
              height: `${balancedLayout.height}px`,
              '--event-gallery-gap': `${masonryMetrics.gap}px`,
            }}
          >
            {balancedLayout.items.map(photo => (
              <button
                key={`${photo.src}-${photo.index}`}
                type="button"
                className="event-gallery-photo"
                onClick={event => openLightbox(photo.index, event.currentTarget)}
                aria-label={`פתיחת תמונה ${photo.index + 1} מתוך ${item.images.length}`}
                style={{
                  '--gallery-photo-delay': `${Math.min(photo.index, 12) * 35}ms`,
                  left: `${photo.x}px`,
                  top: `${photo.y}px`,
                  width: `${photo.width}px`,
                  height: `${photo.height}px`,
                }}
              >
                <img
                  src={photo.src}
                  alt={`${item.title} — תמונה ${photo.index + 1}`}
                  loading={photo.index < 6 ? 'eager' : 'lazy'}
                  decoding="async"
                  onLoad={event => recordImageRatio(photo.src, event.currentTarget)}
                />
                <span className="event-gallery-photo-hover" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                    <path d="M11 8v6M8 11h6" />
                  </svg>
                </span>
              </button>
            ))}
          </div>

          {hasMoreImages && (
            <div ref={loadMoreRef} className="event-gallery-load-more" aria-live="polite">
              <span />
              טוענים עוד רגעים…
            </div>
          )}

          <footer className="event-gallery-footer">
            <span style={{ fontFamily: typography?.bodyFamily }}>
              סוף הגלריה
            </span>
            <button type="button" onClick={onClose}>
              חזרה לכל העבודות
            </button>
          </footer>
        </main>
      </div>

      {openingVisible && originRect && (
        <div
          className="event-gallery-opening"
          aria-hidden="true"
          style={openingExpanded
            ? {
                top: 0,
                left: 0,
                width: '100vw',
                height: openingTargetHeight,
                borderRadius: 0,
              }
            : {
                top: originRect.top,
                left: originRect.left,
                width: originRect.width,
                height: originRect.height,
                borderRadius: '2px',
              }}
        >
          <img src={item.coverImage} alt="" style={heroCoverStyle} />
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={item.images}
          initialIndex={lightbox.index}
          originRect={lightbox.originRect}
          title={item.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>,
    document.body,
  );
}
