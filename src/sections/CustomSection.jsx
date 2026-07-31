import SoftReveal from '../components/SoftReveal';
import { getSectionBackground, getSectionTypography } from '../utils/sectionStyles';
import { normalizeCustomPosition } from '../utils/siteSections';
import './custom-section.css';

export default function CustomSection({ id, data, config }) {
  if (!data?.created || data.enabled === false) return null;

  const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  const typography = getSectionTypography(config, id);
  const desktop = normalizeCustomPosition(data.desktopPosition);
  const mobile = normalizeCustomPosition(data.mobilePosition);
  const layout = ['split', 'editorial', 'stack', 'free'].includes(data.layout) ? data.layout : 'split';
  const titleId = `${id}-title`;
  const style = {
    backgroundColor: getSectionBackground(data.backgroundColor || 'background'),
    '--custom-content-x': `${desktop.contentX}%`,
    '--custom-content-y': `${desktop.contentY}%`,
    '--custom-media-x': `${desktop.mediaX}%`,
    '--custom-media-y': `${desktop.mediaY}%`,
    '--custom-mobile-content-x': `${mobile.contentX}%`,
    '--custom-mobile-content-y': `${mobile.contentY}%`,
    '--custom-mobile-media-x': `${mobile.mediaX}%`,
    '--custom-mobile-media-y': `${mobile.mediaY}%`,
    '--custom-text-align': data.textAlign || 'right',
  };

  return (
    <section
      id={id}
      className={[
        'custom-site-section',
        `custom-site-section--${layout}`,
        data.imageSide === 'end' ? 'is-media-end' : 'is-media-start',
        images.length ? 'has-media' : 'has-no-media',
      ].join(' ')}
      style={style}
      aria-labelledby={data.title ? titleId : undefined}
    >
      <div className="custom-site-container">
        <SoftReveal className="custom-site-copy" variant="soft-open">
          {data.eyebrow && (
            <span className="custom-site-eyebrow" style={{ fontFamily: typography.accentFamily }}>
              {data.eyebrow}
            </span>
          )}
          {data.title && (
            <h2 id={titleId} style={{ fontFamily: typography.headingFamily }}>
              {data.title}
            </h2>
          )}
          {data.text && (
            <p style={{ fontFamily: typography.bodyFamily }}>
              {data.text}
            </p>
          )}
        </SoftReveal>

        {images.length > 0 && (
          <div className="custom-site-media" data-image-count={Math.min(images.length, 4)}>
            {images.slice(0, 4).map((source, index) => (
              <SoftReveal
                as="figure"
                className={`custom-site-image custom-site-image--${index + 1}`}
                variant="image-rise"
                delay={index * 0.06}
                key={`${source}-${index}`}
              >
                <img
                  src={source}
                  alt={`${data.title || data.navLabel || 'אזור אישי'} — תמונה ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                />
              </SoftReveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
