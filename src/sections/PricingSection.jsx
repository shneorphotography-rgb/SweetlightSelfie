import SoftReveal from '../components/SoftReveal';
import { getSectionBackground, getSectionTypography } from '../utils/sectionStyles';

const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

function Price({ item }) {
  if (!item?.price) return null;

  return (
    <div className="pricing-price" dir="rtl" aria-label={`${item.price} ${item.priceNote || ''}`.trim()}>
      {item.showOriginalPrice && item.originalPrice && (
        <span className="pricing-price-original" dir="ltr" aria-label={`מחיר קודם ${item.originalPrice}`}>
          {item.originalCurrency && <span>{item.originalCurrency}</span>}
          {item.originalPrice}
        </span>
      )}
      <span className="pricing-price-value" dir="ltr">
        {item.currency && <span className="pricing-price-currency">{item.currency}</span>}
        {item.price}
      </span>
      {item.priceNote && <span className="pricing-price-note">{item.priceNote}</span>}
    </div>
  );
}

function FeatureList({ features }) {
  const items = toArray(features);
  if (!items.length) return null;

  return (
    <ul className="pricing-feature-list">
      {items.map((feature, index) => (
        <li key={`${feature}-${index}`} className="pricing-feature-item">
          <span className="pricing-feature-mark" aria-hidden="true">✓</span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

function ImageStrip({ images, title, variant = 'package' }) {
  const items = toArray(images);
  if (!items.length) return null;

  return (
    <div className={`pricing-media pricing-media--${variant}`} data-image-count={items.length}>
      {items.map((src, index) => (
        <figure className="pricing-media-item" key={`${src}-${index}`}>
          <img
            src={src}
            alt={`${title || 'שירות צילום'} — תמונה ${index + 1}`}
            loading="lazy"
            decoding="async"
          />
        </figure>
      ))}
    </div>
  );
}

function PackageCard({ item, typography, index }) {
  return (
    <SoftReveal
      as="article"
      className={`pricing-package${item.featured ? ' pricing-package--featured' : ''}`}
      variant="card"
      delay={index * 0.05}
    >
      <div className="pricing-package-copy">
        <header className="pricing-item-header">
          <div>
            {item.label && <p className="pricing-item-label">{item.label}</p>}
            <h3 className="pricing-item-title" style={{ fontFamily: typography.headingFamily }}>
              {item.title}
            </h3>
          </div>
          <Price item={item} />
        </header>

        {item.description && (
          <p className="pricing-item-description" style={{ fontFamily: typography.bodyFamily }}>
            {item.description}
          </p>
        )}
        <FeatureList features={item.features} />
      </div>
      <ImageStrip images={item.images} title={item.title} variant="package" />
    </SoftReveal>
  );
}

function AddonCard({ item, typography, index }) {
  return (
    <SoftReveal
      as="article"
      className="pricing-addon"
      variant="card"
      delay={index * 0.05}
    >
      <ImageStrip images={item.images} title={item.title} variant="addon" />
      <div className="pricing-addon-copy">
        <header className="pricing-item-header pricing-item-header--compact">
          <h3 className="pricing-item-title" style={{ fontFamily: typography.headingFamily }}>
            {item.title}
          </h3>
          <Price item={item} />
        </header>
        {item.description && (
          <p className="pricing-item-description" style={{ fontFamily: typography.bodyFamily }}>
            {item.description}
          </p>
        )}
        <FeatureList features={item.features} />
      </div>
    </SoftReveal>
  );
}

export default function PricingSection({ data, config }) {
  if (!data || data.enabled === false) return null;

  const packages = toArray(data.packages || (data.package ? [data.package] : []));
  const addons = toArray(data.addons || data.services);
  const typography = getSectionTypography(config, 'pricing');

  if (!packages.length && !addons.length) return null;

  return (
    <section
      id="pricing"
      className="pricing-section"
      style={{ backgroundColor: getSectionBackground(data.backgroundColor || 'surface') }}
      aria-labelledby="pricing-title"
    >
      <div className="pricing-container">
        <SoftReveal className="pricing-heading" variant="soft-open">
          {data.eyebrow && <p className="pricing-eyebrow">{data.eyebrow}</p>}
          <h2 id="pricing-title" className="section-title pricing-title" style={{ fontFamily: typography.headingFamily }}>
            {data.title || 'הצעת מחיר'}
          </h2>
          <div className="section-line" />
          {data.intro && (
            <p className="pricing-intro" style={{ fontFamily: typography.bodyFamily }}>
              {data.intro}
            </p>
          )}
        </SoftReveal>

        {packages.length > 0 && (
          <div className="pricing-packages" aria-label="חבילות צילום">
            {packages.map((item, index) => (
              <PackageCard key={item.id || `${item.title}-${index}`} item={item} index={index} typography={typography} />
            ))}
          </div>
        )}

        {addons.length > 0 && (
          <div className="pricing-addons-section">
            <header className="pricing-addons-heading">
              <p className="pricing-item-label">לבחירתכם</p>
              <h3 style={{ fontFamily: typography.headingFamily }}>
                {data.addonsTitle || 'שירותים שאפשר להוסיף'}
              </h3>
            </header>
            <div className="pricing-addons-grid">
              {addons.map((item, index) => (
                <AddonCard key={item.id || `${item.title}-${index}`} item={item} index={index} typography={typography} />
              ))}
            </div>
          </div>
        )}

        {(data.terms || data.ctaLabel) && (
          <SoftReveal className="pricing-footer" variant="soft-open">
            {data.terms && (
              <p className="pricing-terms" style={{ fontFamily: typography.bodyFamily }}>
                {data.terms}
              </p>
            )}
            {data.ctaLabel && (
              <a className="pricing-cta" href={data.ctaHref || '#contact'}>
                {data.ctaLabel}
                <span aria-hidden="true">←</span>
              </a>
            )}
          </SoftReveal>
        )}
      </div>
    </section>
  );
}
