import { useEffect, useState } from 'react';
import SoftReveal from '../components/SoftReveal';
import { getSectionBackground, getSectionTypography } from '../utils/sectionStyles';

const AUTO_ADVANCE_DELAY = 6000;
const SLIDE_TRANSITION_MS = 1150;

export default function TestimonialsSection({ data, config }) {
  const reviews = data?.reviews || [];
  const showStars = data?.showStars !== false;
  const typography = getSectionTypography(config, 'testimonials');
  const [activeSlide, setActiveSlide] = useState(reviews.length > 1 ? 1 : 0);
  const [isSliding, setIsSliding] = useState(false);
  const [isInstant, setIsInstant] = useState(false);

  useEffect(() => {
    setActiveSlide(reviews.length > 1 ? 1 : 0);
    setIsSliding(false);
    setIsInstant(false);
  }, [reviews.length]);

  useEffect(() => {
    if (!isInstant) return undefined;
    const frame = requestAnimationFrame(() => setIsInstant(false));
    return () => cancelAnimationFrame(frame);
  }, [isInstant]);

  useEffect(() => {
    if (reviews.length <= 1 || isSliding || isInstant) return undefined;
    const timer = setTimeout(() => {
      setIsSliding(true);
      setActiveSlide((current) => current + 1);
    }, AUTO_ADVANCE_DELAY);

    return () => clearTimeout(timer);
  }, [activeSlide, isInstant, isSliding, reviews.length]);

  if (!data || !data.enabled || !reviews.length) return null;

  const slides =
    reviews.length > 1
      ? [reviews[reviews.length - 1], ...reviews, reviews[0]]
      : reviews;

  const getReviewIndex = (slideIndex) => {
    if (reviews.length <= 1) return 0;
    if (slideIndex === 0) return reviews.length - 1;
    if (slideIndex === reviews.length + 1) return 0;
    return slideIndex - 1;
  };

  const activeReviewIndex = getReviewIndex(activeSlide);

  const goToPrevious = () => {
    if (reviews.length <= 1 || isSliding || isInstant) return;
    setIsInstant(false);
    setIsSliding(true);
    setActiveSlide((current) => current - 1);
  };

  const goToNext = () => {
    if (reviews.length <= 1 || isSliding || isInstant) return;
    setIsInstant(false);
    setIsSliding(true);
    setActiveSlide((current) => current + 1);
  };

  const goToReview = (reviewIndex) => {
    if (reviews.length <= 1 || isSliding || isInstant || reviewIndex === activeReviewIndex) return;
    setIsInstant(false);
    setIsSliding(true);
    setActiveSlide(reviewIndex + 1);
  };

  const handleTransitionEnd = () => {
    if (reviews.length <= 1) return;

    if (activeSlide === 0) {
      setIsInstant(true);
      setIsSliding(false);
      setActiveSlide(reviews.length);
      return;
    }

    if (activeSlide === reviews.length + 1) {
      setIsInstant(true);
      setIsSliding(false);
      setActiveSlide(1);
      return;
    }

    setIsSliding(false);
  };

  const renderReview = (item, index) => (
    <article
      key={`${item.name}-${index}`}
      className="testimonial-slide"
      aria-hidden={index !== activeSlide}
    >
      <div className="testimonial-slide-inner">
        <p className="testimonial-text" style={{ fontFamily: typography.bodyFamily }}>
          <span className="testimonial-inline-quote" aria-hidden="true" style={{ fontFamily: typography.headingFamily }}>
            &ldquo;
          </span>
          <span>{item.text}</span>
          <span className="testimonial-inline-quote" aria-hidden="true" style={{ fontFamily: typography.headingFamily }}>
            &rdquo;
          </span>
        </p>

        <div className="testimonial-meta">
          {item.image && <img src={item.image} alt={item.name} className="testimonial-avatar" />}

          <div>
            <div className="testimonial-name" style={{ fontFamily: typography.nameFamily }}>{item.name}</div>
            {showStars && (
              <div className="testimonial-rating">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <span key={starIndex} className="testimonial-star">
                    ★
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );

  return (
    <section id="testimonials" className="testimonial-shell" style={{ backgroundColor: getSectionBackground(data.backgroundColor || 'surface') }}>
      <SoftReveal className="testimonial-card" variant="card">
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="section-title" style={{ fontFamily: typography.headingFamily }}>{data.title}</h2>
          <div className="section-line" />
        </div>

        {reviews.length > 1 && (
          <>
            <button
              type="button"
              className="testimonial-nav testimonial-nav--prev"
              onClick={goToNext}
              aria-label="המלצה הבאה"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <button
              type="button"
              className="testimonial-nav testimonial-nav--next"
              onClick={goToPrevious}
              aria-label="המלצה קודמת"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </>
        )}

        <div className="testimonial-stage">
          <div
            className="testimonial-track"
            onTransitionEnd={handleTransitionEnd}
            style={{
              transform: `translate3d(-${activeSlide * 100}%, 0, 0)`,
              transitionDuration: isInstant ? '0ms' : `${SLIDE_TRANSITION_MS}ms`,
            }}
          >
            {slides.map((item, index) => renderReview(item, index))}
          </div>
        </div>

        {reviews.length > 1 && (
          <div className="testimonial-controls">
            <div className="testimonial-dots">
              {reviews.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToReview(index)}
                  className={`testimonial-dot${index === activeReviewIndex ? ' active' : ''}`}
                  aria-label={`הצגת המלצה ${index + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </SoftReveal>
    </section>
  );
}
