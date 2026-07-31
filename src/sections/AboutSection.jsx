import SoftReveal from '../components/SoftReveal';
import { getImageFrameStyle, normalizeFrame } from '../utils/imageFrame';
import { getSectionBackground, getSectionTypography } from '../utils/sectionStyles';
import { normalizeMultilineText } from '../utils/textFormatting';
import '../editor/about-design.css';

const DEFAULT_TEXT_STYLE = {
  preset: 'none',
  color: '',
  shadowEnabled: false,
  shadowColor: '#1A1814',
  shadowOpacity: 22,
  shadowBlur: 12,
  shadowX: 0,
  shadowY: 4,
  outlineEnabled: false,
  outlineColor: '#FAFAF8',
  outlineWidth: 1,
};

function normalizeTextStyle(value) {
  return { ...DEFAULT_TEXT_STYLE, ...(value || {}) };
}

function normalizeImages(data) {
  if (Array.isArray(data.images) && data.images.length) {
    return data.images
      .map((image, index) => {
        if (typeof image === 'string') return { id: `about-${index}`, src: image, frame: {} };
        return image?.src ? { ...image, id: image.id || `about-${index}`, frame: image.frame || {} } : null;
      })
      .filter(Boolean);
  }
  return data.image ? [{ id: 'about-legacy-profile', src: data.image, frame: data.imageFrame || {} }] : [];
}

function hexToRgba(hex, opacity) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '000000';
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
}

function getHeadingEffectStyle(value) {
  const style = normalizeTextStyle(value);
  const shadows = [];

  if (style.shadowEnabled) {
    shadows.push(`${style.shadowX}px ${style.shadowY}px ${style.shadowBlur}px ${hexToRgba(style.shadowColor, style.shadowOpacity)}`);
  }
  if (style.preset === 'embossed') {
    shadows.push('-1px -1px 0 rgba(255,255,255,.32)');
  }

  return {
    color: style.color || undefined,
    textShadow: shadows.length ? shadows.join(', ') : undefined,
    WebkitTextStroke: style.outlineEnabled ? `${style.outlineWidth}px ${style.outlineColor}` : undefined,
    paintOrder: style.outlineEnabled ? 'stroke fill' : undefined,
  };
}

function getFrame(image) {
  const frame = image.frame || {};
  if (Number.isFinite(frame.x) || Number.isFinite(frame.y) || Number.isFinite(frame.zoom)) {
    return normalizeFrame(frame);
  }
  const focus = image.coverFocus;
  if (focus && Number.isFinite(focus.x) && Number.isFinite(focus.y)) {
    return normalizeFrame({ x: focus.x - 50, y: focus.y - 50, zoom: 1 });
  }
  return normalizeFrame({});
}

function AboutMedia({ images, layout, mask, motion }) {
  const imageLimit = layout === 'single' ? 1 : 2;
  const visibleImages = images.slice(0, imageLimit);
  if (!visibleImages.length) return null;

  return (
    <div className={`about-media-cluster about-media-layout-${layout}`}>
      {visibleImages.map((image, index) => (
        <SoftReveal key={image.id || image.src} variant="image-rise" delay={0.06 + index * 0.08}>
          <figure
            className={[
              'about-media-frame',
              `about-mask-${mask}`,
              mask === 'organic' && motion ? 'has-mask-motion' : '',
              `about-media-frame-${index + 1}`,
            ].filter(Boolean).join(' ')}
          >
            <img
              src={image.src}
              alt={image.alt || ''}
              style={getImageFrameStyle(getFrame(image))}
              loading="lazy"
            />
          </figure>
        </SoftReveal>
      ))}
    </div>
  );
}

export default function AboutSection({ data, config }) {
  if (!data || !data.enabled) return null;
  const typography = getSectionTypography(config, 'about');
  const descriptionText = normalizeMultilineText(data.description);
  const images = normalizeImages(data);
  const mediaLayout = data.mediaLayout || 'single';
  const mediaMask = data.mediaMask || 'soft-square';
  const contentPosition = data.contentPosition || 'start';
  const statsLayout = data.statsLayout || 'row';
  const hasMedia = images.length > 0;

  return (
    <section
      id="about"
      className={`about-section about-content-${contentPosition}${hasMedia ? ' has-media' : ' is-text-only'}`}
      style={{ backgroundColor: getSectionBackground(data.backgroundColor || 'surface') }}
    >
      <div className="about-section-shell">
        {hasMedia && (
          <AboutMedia
            images={images}
            layout={mediaLayout}
            mask={mediaMask}
            motion={data.maskMotion !== false}
          />
        )}

        <SoftReveal variant="soft-open" delay={0.16}>
          <div className="about-copy">
            <h2
              className="section-title about-title"
              style={{
                fontFamily: typography.headingFamily,
                ...getHeadingEffectStyle(data.textStyle),
              }}
            >
              {data.title}
            </h2>

            <div className="about-accent-line" aria-hidden="true" />

            <div className="about-description-wrapper">
              <p className="about-description" style={{ fontFamily: typography.bodyFamily }}>
                {descriptionText}
              </p>
            </div>

            {Array.isArray(data.stats) && data.stats.length > 0 && (
              <div className={`about-stats-row about-stats-${statsLayout}`}>
                {data.stats.map((stat, index) => (
                  <div className="about-stat" key={stat.id || `${stat.value}-${index}`}>
                    <div className="about-stat-value" style={{ fontFamily: typography.accentFamily }}>{stat.value}</div>
                    <div className="about-stat-label" style={{ fontFamily: typography.nameFamily }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SoftReveal>
      </div>
    </section>
  );
}
