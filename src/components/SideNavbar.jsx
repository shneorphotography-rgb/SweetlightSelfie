import { useTheme } from '../theme/ThemeContext';

export default function SideNavbar({ sections }) {
  const { theme, toggleTheme, config } = useTheme();

  const navLinks = sections
    .filter(s => s.enabled)
    .map(s => ({ id: s.id, label: s.label }));
  const homeHref = navLinks.length ? `#${navLinks[0].id}` : '#';

  return (
    <aside
      className="fixed right-0 top-0 h-screen z-50 flex flex-col justify-between p-8 transition-colors duration-300"
      style={{
        width: '280px',
        backgroundColor: 'var(--color-surface)',
        borderLeft: '1px solid rgba(128,128,128,0.1)'
      }}
    >
      <div>
        {/* Logo */}
        <div className="mb-12">
          <a href={homeHref} className="text-2xl font-heading font-bold block" style={{ letterSpacing: '0.05em', color: 'var(--color-text)' }}>
            {config.photographer.name}
          </a>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
            {config.photographer.title}
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-6">
          {navLinks.map(link => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="nav-link text-lg transition-colors"
              style={{ color: 'var(--color-text)' }}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="space-y-4">
        {/* Social Links */}
        <div className="flex gap-4">
          {config.photographer.instagram && (
            <a href={config.photographer.instagram} target="_blank" rel="noopener noreferrer" className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
              📷
            </a>
          )}
          {config.photographer.facebook && (
            <a href={config.photographer.facebook} target="_blank" rel="noopener noreferrer" className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
              👤
            </a>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {theme === 'dark' ? '☀️ מצב בהיר' : '🌙 מצב כהה'}
        </button>
      </div>
    </aside>
  );
}
