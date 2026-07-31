import SoftReveal from '../components/SoftReveal';
import { getCoverFrameStyle } from '../utils/imageFrame';

export default function StoriesGallery({ items, columns = 2, typography, onSelectItem }) {
  return (
    <div className="insta-grid" style={{ '--story-columns': columns }}>
      {items.map((item, index) => (
        <SoftReveal
          as="button"
          type="button"
          key={item.id}
          className="insta-item gallery-project-button"
          variant="gallery-item"
          delay={Math.min(index * 0.05, 0.3)}
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
            loading="lazy"
            style={getCoverFrameStyle(item)}
          />
          <div className="insta-overlay">
            <span className="insta-overlay-cat" style={{ fontFamily: typography?.bodyFamily }}>{item.category}</span>
            <span className="insta-overlay-title" style={{ fontFamily: typography?.headingFamily }}>{item.title}</span>
          </div>
        </SoftReveal>
      ))}
    </div>
  );
}
