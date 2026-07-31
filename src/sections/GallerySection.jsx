import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LayoutEngine from '../components/LayoutEngine';
import SoftReveal from '../components/SoftReveal';
import EventGalleryView from '../layouts/EventGalleryView';
import { getSectionBackground, getSectionTypography } from '../utils/sectionStyles';

export default function GallerySection({ data, config }) {
  const [activeCategory, setActiveCategory] = useState(config.categories?.[0] || 'הכל');
  const [selectedGallery, setSelectedGallery] = useState(null);
  const pushedGalleryHistory = useRef(false);
  const typography = getSectionTypography(config, 'gallery');

  if (!data || !data.enabled) return null;

  const isAllCategory = activeCategory === 'הכל';
  const filteredItems = useMemo(() => (
    isAllCategory
      ? config.galleryItems
      : config.galleryItems.filter((item) => item.category === activeCategory)
  ), [activeCategory, config.galleryItems, isAllCategory]);

  const desktopColumns = isAllCategory
    ? Math.min(Math.max(data.columnsAll || 3, 1), 4)
    : Math.min(Math.max(data.columnsFiltered || 2, 1), 4);

  const galleryMaxWidth = isAllCategory ? '1367px' : '1120px';
  const moreCtaEnabled = data.moreCtaEnabled !== false;
  const moreCtaHref = String(data.moreCtaHref || '').trim();
  const moreCtaLabel = data.moreCtaLabel || 'בא לכם לראות עוד? לחצו כאן';

  const openGallery = useCallback((item, originRect) => {
    const url = new URL(window.location.href);
    url.searchParams.set('gallery', String(item.id));
    window.history.pushState({ portfolioGalleryId: item.id }, '', url);
    pushedGalleryHistory.current = true;
    setSelectedGallery({ item, originRect });
  }, []);

  const closeGallery = useCallback(() => {
    const url = new URL(window.location.href);

    if (pushedGalleryHistory.current && url.searchParams.has('gallery')) {
      pushedGalleryHistory.current = false;
      window.history.back();
      return;
    }

    url.searchParams.delete('gallery');
    window.history.replaceState(window.history.state, '', url);
    setSelectedGallery(null);
  }, []);

  useEffect(() => {
    const syncGalleryFromUrl = () => {
      const galleryId = new URL(window.location.href).searchParams.get('gallery');
      const matchingItem = config.galleryItems.find(item => String(item.id) === galleryId);
      setSelectedGallery(matchingItem ? { item: matchingItem, originRect: null } : null);
      pushedGalleryHistory.current = false;
    };

    syncGalleryFromUrl();
    window.addEventListener('popstate', syncGalleryFromUrl);
    return () => window.removeEventListener('popstate', syncGalleryFromUrl);
  }, [config.galleryItems]);

  return (
    <section
      id="gallery"
      style={{
        backgroundColor: getSectionBackground(data.backgroundColor || 'background'),
        paddingTop: '5rem',
        paddingBottom: '5rem',
      }}
    >
      <SoftReveal className="text-center" style={{ marginBottom: '3rem' }} variant="soft-open">
        <h2 className="section-title" style={{ fontFamily: typography.headingFamily }}>{data.title}</h2>
        <div className="section-line" />
      </SoftReveal>

      {data.showFilters && config.categories && (
        <SoftReveal
          className="flex flex-wrap justify-center gallery-filters"
          style={{ gap: '2rem', marginBottom: '3rem' }}
          variant="rise"
          delay={0.08}
        >
          {config.categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`filter-tab${activeCategory === category ? ' active' : ''}`}
              style={{ fontFamily: typography.bodyFamily }}
            >
              {category}
            </button>
          ))}
        </SoftReveal>
      )}

      <div style={{ maxWidth: galleryMaxWidth, margin: '0 auto', padding: '0 1rem' }}>
        {filteredItems.length > 0 ? (
          <LayoutEngine
            layout={config.layout.type}
            items={filteredItems}
            columns={{
              desktop: desktopColumns,
              tablet: Math.min(desktopColumns, 2),
              mobile: 1,
            }}
            storyColumns={desktopColumns}
            typography={typography}
            onSelectItem={openGallery}
          />
        ) : (
          <div className="text-center" style={{ padding: '5rem 0', color: 'var(--color-text-muted)', fontFamily: typography.bodyFamily }}>
            <p>אין תמונות בקטגוריה זו</p>
          </div>
        )}
      </div>

      {moreCtaEnabled && (
        <SoftReveal className="text-center" style={{ marginTop: '60px', marginBottom: '80px' }} variant="rise" delay={0.12}>
          {moreCtaHref ? (
            <a
              href={moreCtaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="gallery-cta-btn"
              style={{ fontFamily: typography.accentFamily || typography.bodyFamily }}
            >
              {moreCtaLabel}
            </a>
          ) : (
            <span
              className="gallery-cta-btn"
              style={{ fontFamily: typography.accentFamily || typography.bodyFamily, opacity: 0.62, cursor: 'default' }}
            >
              {moreCtaLabel}
            </span>
          )}
        </SoftReveal>
      )}

      {selectedGallery && (
        <EventGalleryView
          item={selectedGallery.item}
          originRect={selectedGallery.originRect}
          typography={typography}
          onClose={closeGallery}
        />
      )}
    </section>
  );
}
