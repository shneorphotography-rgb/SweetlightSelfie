import { useEffect, useMemo, useState } from 'react';
import HeroOverlay from '../components/HeroOverlay';
import {
  getHeroFrameStyle,
  HERO_PREVIEW_END_EVENT,
  HERO_PREVIEW_EVENT,
  normalizeCoverFrame,
  normalizeHeroImage,
} from '../utils/imageFrame';
import { getSectionTypography } from '../utils/sectionStyles';
import '../editor/hero-media.css';

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

function useMobileHeroFrame() {
  const [mobile, setMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ));

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const handleChange = () => setMobile(media.matches);
    handleChange();
    media.addEventListener?.('change', handleChange);
    return () => media.removeEventListener?.('change', handleChange);
  }, []);

  return mobile ? 'mobile' : 'desktop';
}

export default function HeroSection({ config }) {
  const { hero } = config.sections;
  const typography = getSectionTypography(config, 'hero');
  const frameVariant = useMobileHeroFrame();
  const [current, setCurrent] = useState(0);
  const [previewSource, setPreviewSource] = useState('');

  const slides = useMemo(() => {
    const rawSlides = Array.isArray(hero.images) && hero.images.length
      ? [...hero.images]
      : config.galleryItems
          .filter((item) => item.coverImage)
          .slice(0, 6)
          .map((item) => ({ src: item.coverImage, ...normalizeCoverFrame(item) }));

    const normalized = rawSlides
      .map((item) => normalizeHeroImage(item, hero.imagePositions))
      .filter((item) => item.src);

    if (hero.backgroundImage && !normalized.some((slide) => slide.src === hero.backgroundImage)) {
      normalized.unshift(normalizeHeroImage({ src: hero.backgroundImage }, hero.imagePositions));
    }

    return normalized;
  }, [config.galleryItems, hero.backgroundImage, hero.imagePositions, hero.images]);

  const displaySeconds = clamp(hero.slideDuration ?? 5.5, 2, 15);
  const transitionSeconds = clamp(hero.transitionDuration ?? 1.2, 0.2, 3);
  const transition = ['dissolve', 'pan', 'soft-zoom', 'still'].includes(hero.transition)
    ? hero.transition
    : 'dissolve';

  useEffect(() => {
    const showPreview = (event) => {
      const src = event.detail?.src;
      if (!src) return;
      setPreviewSource(src);
    };
    const endPreview = () => setPreviewSource('');
    window.addEventListener(HERO_PREVIEW_EVENT, showPreview);
    window.addEventListener(HERO_PREVIEW_END_EVENT, endPreview);
    return () => {
      window.removeEventListener(HERO_PREVIEW_EVENT, showPreview);
      window.removeEventListener(HERO_PREVIEW_END_EVENT, endPreview);
    };
  }, []);

  useEffect(() => {
    if (!previewSource) return;
    const index = slides.findIndex((slide) => slide.src === previewSource);
    if (index >= 0) setCurrent(index);
  }, [previewSource, slides]);

  useEffect(() => {
    if (previewSource || slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setCurrent((value) => (value + 1) % slides.length);
    }, displaySeconds * 1000);
    return () => window.clearInterval(timer);
  }, [displaySeconds, previewSource, slides.length]);

  useEffect(() => {
    if (current >= slides.length) setCurrent(0);
  }, [current, slides.length]);

  if (!hero.enabled) return null;

  const goTo = (index) => {
    setPreviewSource('');
    setCurrent(index);
  };
  const goToPrevious = () => goTo((current - 1 + slides.length) % slides.length);
  const goToNext = () => goTo((current + 1) % slides.length);

  return (
    <section
      id="hero"
      className="relative h-screen overflow-hidden ssf-hero-section"
      data-transition={transition}
      data-editor-preview={previewSource ? 'true' : 'false'}
      style={{
        '--ssf-hero-transition-duration': `${previewSource ? Math.min(transitionSeconds, 0.36) : transitionSeconds}s`,
        '--ssf-hero-display-duration': `${displaySeconds + transitionSeconds}s`,
      }}
    >
      {slides.map((slide, index) => {
        const active = index === current;
        return (
          <div
            key={`${slide.src}-${index}`}
            className={`ssf-hero-slide${active ? ' is-active' : ''}`}
            style={{ zIndex: active ? 1 : 0 }}
            aria-hidden={!active}
          >
            <img
              src={slide.src}
              alt=""
              className="ssf-hero-slide__image"
              style={getHeroFrameStyle(slide, frameVariant)}
              loading={index === 0 ? 'eager' : 'lazy'}
              draggable="false"
            />
          </div>
        );
      })}

      <HeroOverlay config={config} hero={hero} typography={typography} />

      {slides.length > 1 && (
        <>
          <button type="button" className="hero-nav hero-nav--prev" onClick={goToPrevious} aria-label="תמונה קודמת">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button type="button" className="hero-nav hero-nav--next" onClick={goToNext} aria-label="תמונה הבאה">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute flex items-center gap-2 ssf-hero-dots">
          {slides.map((slide, index) => (
            <button
              key={`${slide.src}-${index}`}
              type="button"
              onClick={() => goTo(index)}
              className="slide-dot"
              style={{ width: index === current ? '28px' : '6px', opacity: index === current ? 1 : 0.35 }}
              aria-label={`תמונה ${index + 1}`}
              aria-current={index === current ? 'true' : undefined}
            />
          ))}
        </div>
      )}

      {hero.scrollIndicator && (
        <div className="scroll-indicator absolute flex flex-col items-center gap-1 ssf-hero-scroll">
          <svg width="1" height="48" viewBox="0 0 1 48" aria-hidden="true">
            <line x1="0.5" y1="0" x2="0.5" y2="48" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
          </svg>
          <span style={{ fontFamily: typography.bodyFamily }}>גלול</span>
        </div>
      )}
    </section>
  );
}
