import { useCallback, useEffect, useRef, useState } from 'react';

const FADE_MS = 460;
const ADVANCE_MS = 4500;
const OPENING_MS = 540;
const TOP_BAR_H = 56;

function FadeOut({ src, duration }) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setOpacity(0));
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, []);

  return (
    <img
      src={src}
      alt=""
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        opacity,
        transition: `opacity ${duration}ms ease`,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  );
}

export default function Lightbox({
  images = [],
  initialIndex = 0,
  originRect = null,
  title = 'גלריה',
  onClose,
}) {
  const imageCount = images.length;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const safeInitialIndex = Math.min(Math.max(initialIndex, 0), Math.max(imageCount - 1, 0));
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const [prevIndex, setPrevIndex] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [openingVisible, setOpeningVisible] = useState(Boolean(originRect) && !reduceMotion);
  const [openingExpanded, setOpeningExpanded] = useState(false);
  const closeButtonRef = useRef(null);
  const lightboxRef = useRef(null);
  const previousFocusRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const didSwipeRef = useRef(false);

  const navigate = useCallback((direction) => {
    if (transitioning || imageCount <= 1) return;

    const next = (currentIndex + direction + imageCount) % imageCount;
    setPrevIndex(currentIndex);
    setCurrentIndex(next);
    setTransitioning(true);
    window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => {
      setPrevIndex(null);
      setTransitioning(false);
    }, FADE_MS + 70);
  }, [currentIndex, imageCount, transitioning]);

  useEffect(() => () => {
    window.clearTimeout(transitionTimerRef.current);
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
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
    const finishTimer = window.setTimeout(() => setOpeningVisible(false), OPENING_MS + 70);

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      window.clearTimeout(finishTimer);
    };
  }, [originRect, reduceMotion]);

  useEffect(() => {
    if (!playing || imageCount <= 1 || transitioning) return undefined;
    const timer = window.setInterval(() => navigate(1), ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [playing, imageCount, navigate, transitioning]);

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') navigate(1);
      if (event.key === 'ArrowLeft') navigate(-1);
      if (event.key === 'Tab') {
        const focusable = lightboxRef.current?.querySelectorAll(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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
  }, [navigate, onClose]);

  useEffect(() => {
    if (imageCount <= 1) return undefined;

    const nextIndex = (currentIndex + 1) % imageCount;
    const previousIndex = (currentIndex - 1 + imageCount) % imageCount;
    const preloaders = [images[nextIndex], images[previousIndex]].map(src => {
      const image = new Image();
      image.src = src;
      return image;
    });

    return () => {
      preloaders.forEach(image => {
        image.src = '';
      });
    };
  }, [currentIndex, imageCount, images]);

  if (imageCount === 0) return null;

  const buttonBase = {
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const handlePointerDown = event => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    didSwipeRef.current = false;
  };

  const handlePointerUp = event => {
    if (!pointerStartRef.current) return;

    const deltaX = event.clientX - pointerStartRef.current.x;
    const deltaY = event.clientY - pointerStartRef.current.y;
    pointerStartRef.current = null;

    if (Math.abs(deltaX) >= 52 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      didSwipeRef.current = true;
      navigate(deltaX < 0 ? 1 : -1);
    }
  };

  return (
    <div
      ref={lightboxRef}
      className="portfolio-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — תצוגת תמונה`}
      onClick={() => {
        if (didSwipeRef.current) {
          didSwipeRef.current = false;
          return;
        }
        onClose();
      }}
    >
      <div className="portfolio-lightbox-topbar" onClick={event => event.stopPropagation()}>
        <span className="portfolio-lightbox-title">{title}</span>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="סגירת התמונה"
          style={{
            ...buttonBase,
            width: '44px',
            height: '44px',
            fontSize: '1.15rem',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.09)',
            backdropFilter: 'blur(8px)',
          }}
        >
          ✕
        </button>
      </div>

      <div
        className="portfolio-lightbox-stage"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartRef.current = null;
        }}
      >
        <img
          key={currentIndex}
          src={images[currentIndex]}
          alt={`${title} — תמונה ${currentIndex + 1}`}
          className="portfolio-lightbox-image"
          style={{ opacity: openingVisible ? 0 : 1 }}
          onClick={event => {
            didSwipeRef.current = false;
            event.stopPropagation();
          }}
          onError={() => console.error('Lightbox image failed:', images[currentIndex])}
        />

        {prevIndex !== null && (
          <FadeOut
            key={`fade-${prevIndex}`}
            src={images[prevIndex]}
            duration={FADE_MS}
          />
        )}
      </div>

      {openingVisible && originRect && (
        <img
          src={images[currentIndex]}
          alt=""
          className="portfolio-lightbox-opening-image"
          aria-hidden="true"
          style={openingExpanded
            ? {
                top: `calc(env(safe-area-inset-top) + ${TOP_BAR_H}px)`,
                left: 0,
                width: '100vw',
                height: `calc(100dvh - env(safe-area-inset-top) - ${TOP_BAR_H}px)`,
                objectFit: 'contain',
                borderRadius: 0,
              }
            : {
                top: originRect.top,
                left: originRect.left,
                width: originRect.width,
                height: originRect.height,
                objectFit: 'cover',
                borderRadius: '2px',
              }}
        />
      )}

      {imageCount > 1 && (
        <>
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              navigate(-1);
            }}
            aria-label="תמונה קודמת"
            className="portfolio-lightbox-nav portfolio-lightbox-nav--previous"
            style={buttonBase}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              navigate(1);
            }}
            aria-label="תמונה הבאה"
            className="portfolio-lightbox-nav portfolio-lightbox-nav--next"
            style={buttonBase}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      <div className="portfolio-lightbox-bottombar" onClick={event => event.stopPropagation()}>
        <div className="portfolio-lightbox-meta">
          <span>{currentIndex + 1} / {imageCount}</span>

          {imageCount > 1 && (
            <>
              <span className="portfolio-lightbox-divider" />
              <button
                type="button"
                onClick={() => setPlaying(current => !current)}
                aria-label={playing ? 'השהיית המצגת' : 'הפעלת המצגת'}
                style={{
                  ...buttonBase,
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  background: 'rgba(0,0,0,0.16)',
                }}
              >
                {playing ? (
                  <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                    <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
                    <rect x="6" y="1" width="2.5" height="8" rx="0.5" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                    <path d="M2 1.5 9 5 2 8.5Z" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
