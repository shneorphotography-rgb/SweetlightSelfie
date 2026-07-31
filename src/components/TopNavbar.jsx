import { useState, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';

export default function TopNavbar({ sections }) {
  const { theme, toggleTheme, config } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = sections
    .filter(s => s.enabled)
    .map(s => ({ id: s.id, label: s.label }));
  const homeHref = navLinks.length ? `#${navLinks[0].id}` : '#';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-3' : 'py-5'
      }`}
      style={{
        backgroundColor: scrolled ? 'color-mix(in srgb, var(--color-surface) 92%, transparent)' : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.1)' : 'none'
      }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <a href={homeHref} className="text-xl font-heading font-bold" style={{ letterSpacing: '0.05em' }}>
          {config.photographer.name}
        </a>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="nav-link text-sm uppercase tracking-wider transition-colors"
              style={{ color: 'var(--color-text)' }}
            >
              {link.label}
            </a>
          ))}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full transition-colors"
            style={{ color: 'var(--color-text)' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2"
            style={{ color: 'var(--color-text)' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2"
            style={{ color: 'var(--color-text)' }}
          >
            <div className="w-6 h-5 flex flex-col justify-between">
              <span className={`block h-0.5 w-full transition-all ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} style={{ backgroundColor: 'var(--color-text)' }}></span>
              <span className={`block h-0.5 w-full transition-all ${mobileOpen ? 'opacity-0' : ''}`} style={{ backgroundColor: 'var(--color-text)' }}></span>
              <span className={`block h-0.5 w-full transition-all ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} style={{ backgroundColor: 'var(--color-text)' }}></span>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          className="md:hidden absolute top-full left-0 right-0 py-6 px-6 animate-fade-in"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          {navLinks.map(link => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="block py-3 text-lg border-b"
              style={{ borderColor: 'var(--color-surface)', color: 'var(--color-text)' }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
