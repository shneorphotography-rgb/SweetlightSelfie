import Masonry from 'react-masonry-css';
import SoftReveal from '../components/SoftReveal';
import { getCoverFrameStyle } from '../utils/imageFrame';

export default function MasonryGallery({
  items,
  columns = { desktop: 3, tablet: 2, mobile: 1 },
  typography,
  onSelectItem,
}) {
  const breakpointColumnsObj = {
    default: columns.desktop,
    1024: columns.tablet,
    640: columns.mobile
  };

  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="masonry-grid"
      columnClassName="masonry-grid-column"
    >
      {items.map((item, index) => (
        <SoftReveal
          as="button"
          type="button"
          key={item.id}
          className="mb-2 relative overflow-hidden cursor-pointer group gallery-project-button"
          variant="gallery-item"
          delay={Math.min(index * 0.05, 0.28)}
          aria-label={`פתיחת הגלריה של ${item.title}`}
          onClick={event => onSelectItem?.(item, event.currentTarget.getBoundingClientRect())}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onSelectItem?.(item, event.currentTarget.getBoundingClientRect());
          }}
        >
          <img
            src={item.coverImage}
            alt={item.title}
            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            style={getCoverFrameStyle(item)}
          />
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
            <div className="text-white text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-4">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ fontFamily: typography?.bodyFamily }}>{item.category}</p>
              <h3 className="text-sm font-light" style={{ fontFamily: typography?.headingFamily }}>{item.title}</h3>
            </div>
          </div>
        </SoftReveal>
      ))}
    </Masonry>
  );
}
