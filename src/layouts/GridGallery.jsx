import SoftReveal from '../components/SoftReveal';
import { getCoverFrameStyle } from '../utils/imageFrame';

export default function GridGallery({ items, columns = 3, typography, onSelectItem }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {items.map((item, index) => (
        <SoftReveal
          as="button"
          type="button"
          key={item.id}
          className="relative overflow-hidden cursor-pointer group rounded-lg gallery-project-button"
          variant="gallery-item"
          delay={Math.min(index * 0.06, 0.3)}
          aria-label={`פתיחת הגלריה של ${item.title}`}
          onClick={event => onSelectItem?.(item, event.currentTarget.getBoundingClientRect())}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onSelectItem?.(item, event.currentTarget.getBoundingClientRect());
          }}
        >
          <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: '3/2' }}>
            <img
              src={item.coverImage}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
              style={getCoverFrameStyle(item)}
            />
            {/* Hover Overlay with gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end justify-center pb-6">
              <div className="text-white text-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--color-accent)', fontFamily: typography?.bodyFamily }}>{item.category}</p>
                <h3 className="text-xl font-light" style={{ fontFamily: typography?.headingFamily }}>{item.title}</h3>
              </div>
            </div>
          </div>
        </SoftReveal>
      ))}
    </div>
  );
}
