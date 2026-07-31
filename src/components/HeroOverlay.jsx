import '../editor/hero-media.css';

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function getHeroTitle(config, hero) {
  if (hasOwn(hero, 'title')) {
    const text = hero.title || '';
    return { text, direction: getTextDirection(text) };
  }

  const language = hero.displayLanguage || 'en';
  const titleEn = hero.titleEn || config.photographer?.signatureName || config.photographer?.name || '';
  const titleHe = hero.titleHe || config.photographer?.name || titleEn;
  const text = language === 'he' ? titleHe : titleEn;
  return { text, direction: language === 'he' ? 'rtl' : getTextDirection(text) };
}

function getTextDirection(text) {
  return /[\u0590-\u08ff]/.test(text || '') ? 'rtl' : 'ltr';
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

function normalizePosition(value, fallback) {
  return {
    x: clamp(Number.isFinite(value?.x) ? value.x : fallback.x, 4, 96),
    y: clamp(Number.isFinite(value?.y) ? value.y : fallback.y, 4, 96),
  };
}

function colorWithOpacity(color = '#000000', opacity = 1) {
  const value = String(color).replace('#', '').trim();
  const normalized = value.length === 3
    ? value.split('').map(character => character + character).join('')
    : value;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return color;
  const number = Number.parseInt(normalized, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${clamp(opacity, 0, 1)})`;
}

function getTextEffectStyle(hero) {
  const effect = hero.textEffects || {};
  const shadow = effect.shadow || {};
  const outline = effect.outline || {};
  const shadowEnabled = shadow.enabled !== false;
  return {
    color: effect.color || '#ffffff',
    textShadow: shadowEnabled
      ? `${Number(shadow.x) || 0}px ${Number.isFinite(shadow.y) ? shadow.y : 8}px ${Number.isFinite(shadow.blur) ? shadow.blur : 24}px ${colorWithOpacity(shadow.color || '#000000', Number.isFinite(shadow.opacity) ? shadow.opacity : 0.34)}`
      : 'none',
    WebkitTextStroke: outline.enabled
      ? `${clamp(outline.width || 1, 0, 4)}px ${outline.color || '#000000'}`
      : '0 transparent',
    paintOrder: 'stroke fill',
  };
}

function getLogoFrameStyle(hero) {
  const style = hero.logoStyle || {};
  const legacyStyle = hero.logoFrameStyle || 'none';
  const shape = style.frameShape || (
    legacyStyle.startsWith('white-disc') || legacyStyle.startsWith('transparent-ring')
      ? 'circle'
      : 'none'
  );
  const hasLegacyWhite = legacyStyle.startsWith('white-disc');
  const hasLegacyRing = legacyStyle.startsWith('transparent-ring');
  const frameEnabled = shape !== 'none';
  const radius = shape === 'circle' ? '999px' : shape === 'soft-square' ? '18px' : shape === 'square' ? '0' : '0';
  const shadowEnabled = style.shadowEnabled ?? legacyStyle.endsWith('shadow');

  return {
    width: `${clamp(style.size || 132, 72, 260)}px`,
    height: `${clamp(style.size || 132, 72, 260)}px`,
    padding: frameEnabled ? `${clamp(style.padding ?? 16, 0, 44)}px` : 0,
    borderRadius: radius,
    background: frameEnabled
      ? colorWithOpacity(style.backgroundColor || '#ffffff', Number.isFinite(style.backgroundOpacity) ? style.backgroundOpacity : hasLegacyWhite ? 0.94 : 0)
      : 'transparent',
    border: frameEnabled && (style.borderWidth > 0 || hasLegacyRing)
      ? `${clamp(style.borderWidth ?? 1, 0, 8)}px solid ${style.borderColor || '#ffffff'}`
      : 'none',
    boxShadow: shadowEnabled
      ? `0 14px ${clamp(style.shadowBlur || 34, 0, 80)}px ${colorWithOpacity(style.shadowColor || '#000000', Number.isFinite(style.shadowOpacity) ? style.shadowOpacity : 0.26)}`
      : 'none',
    backdropFilter: 'none',
  };
}

function getAnimatedProps(preview, delay) {
  if (preview) return { className: '', style: undefined };
  return {
    className: 'ssf-hero-overlay-fade',
    style: { opacity: 0, animationDelay: delay },
  };
}

export default function HeroOverlay({ config, hero, typography, preview = false }) {
  const photographer = config.photographer || {};
  const { text, direction } = getHeroTitle(config, hero);
  const contentDesktop = normalizePosition(hero.contentPlacement?.desktop, { x: 50, y: 61 });
  const contentMobile = normalizePosition(hero.contentPlacement?.mobile, { x: 50, y: 62 });
  const logoDesktop = normalizePosition(hero.logoPlacement?.desktop, { x: 50, y: 32 });
  const logoMobile = normalizePosition(hero.logoPlacement?.mobile, { x: 50, y: 31 });
  const textEffectStyle = getTextEffectStyle(hero);
  const logoAnimation = getAnimatedProps(preview, '0.1s');
  const contentAnimation = getAnimatedProps(preview, '0.3s');

  return (
    <div
      className="ssf-hero-overlay absolute inset-0"
      style={{
        zIndex: 2,
        containerType: preview ? 'size' : undefined,
        '--ssf-hero-content-x-desktop': `${contentDesktop.x}%`,
        '--ssf-hero-content-y-desktop': `${contentDesktop.y}%`,
        '--ssf-hero-content-x-mobile': `${contentMobile.x}%`,
        '--ssf-hero-content-y-mobile': `${contentMobile.y}%`,
        '--ssf-hero-logo-x-desktop': `${logoDesktop.x}%`,
        '--ssf-hero-logo-y-desktop': `${logoDesktop.y}%`,
        '--ssf-hero-logo-x-mobile': `${logoMobile.x}%`,
        '--ssf-hero-logo-y-mobile': `${logoMobile.y}%`,
      }}
    >
      <div
        className="ssf-hero-overlay__shade"
        style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,${hero.overlay ?? 0.44}) 100%)` }}
      />

      {photographer.logo && (
        <div className={`ssf-hero-logo ${logoAnimation.className}`} style={logoAnimation.style}>
          <div
            className="site-logo-wrap site-logo-wrap--hero"
            data-logo-glow="false"
            data-logo-frame="none"
            style={getLogoFrameStyle(hero)}
          >
            <img
              src={photographer.logo}
              alt={photographer.name || 'לוגו'}
              className="site-logo-image site-logo-image--hero ssf-hero-logo__image"
              style={{
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                filter: hero.logoStyle?.imageShadowEnabled === false
                  ? 'none'
                  : `drop-shadow(0 6px 14px ${colorWithOpacity(hero.logoStyle?.imageShadowColor || '#000000', hero.logoStyle?.imageShadowOpacity ?? 0.24)})`,
              }}
            />
          </div>
        </div>
      )}

      <div
        className={`ssf-hero-content${contentAnimation.className ? ` ${contentAnimation.className}` : ''}`}
        style={contentAnimation.style}
      >
        {hero.showTitle !== false && (
          <h1
            className="hero-title ssf-hero-title"
            dir={direction}
            style={{
              ...textEffectStyle,
              fontFamily: hero.titleFontFamily || typography.heroTitleFamily,
            }}
          >
            {text}
          </h1>
        )}

        {hero.showTagline !== false && (
          <p
            className="hero-tagline ssf-hero-tagline"
            dir={getTextDirection(photographer.tagline)}
            style={{
              ...textEffectStyle,
              fontFamily: hero.typography?.bodyFamily || typography.bodyFamily,
            }}
          >
            {photographer.tagline || 'מספר סיפורים דרך העדשה'}
          </p>
        )}

        <div className="hero-divider" />
        <a href="#gallery" className="hero-cta" style={{ fontFamily: hero.typography?.bodyFamily || typography.bodyFamily }}>
          צפו בעבודות
        </a>
      </div>
    </div>
  );
}
