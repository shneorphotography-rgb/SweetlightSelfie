import { useEffect, useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { getWhatsAppHref } from '../utils/contact';

// Navigation-free build: only the scroll-triggered logo badge remains.
export default function HamburgerMenu() {
  const { config } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="fixed z-50 flex items-center"
      style={{
        top: '1.5rem',
        right: '1.5rem',
        opacity: scrolled ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: scrolled ? 'auto' : 'none',
      }}
    >
      <div className="site-logo-wrap site-logo-wrap--nav">
        <img
          src={config.photographer.logo}
          alt={config.photographer.name}
          className="site-logo-image site-logo-image--nav"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        <span
          className="nav-logo-text"
          style={{ display: 'none', color: 'var(--color-text)' }}
        >
          {config.photographer.name}
        </span>
      </div>
    </div>
  );
}
