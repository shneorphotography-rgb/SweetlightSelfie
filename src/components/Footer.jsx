import { getWhatsAppHref } from '../utils/contact';

export default function Footer({ photographer }) {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      backgroundColor: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      padding: '3rem 1.5rem',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div className="footer-name">{photographer.name}</div>
        <div style={{ width: '32px', height: '1px', background: 'var(--color-border)' }} />

        <div className="footer-social" style={{ display: 'flex', gap: '2rem' }}>
          {photographer.instagram && (
            <a
              href={photographer.instagram}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-text-muted)', fontSize: '0.6rem', letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: 'var(--font-body)', textDecoration: 'none', transition: 'color 0.3s' }}
              onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--color-accent)'; }}
              onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              Instagram
            </a>
          )}
          {photographer.facebook && (
            <a
              href={photographer.facebook}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-text-muted)', fontSize: '0.6rem', letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: 'var(--font-body)', textDecoration: 'none', transition: 'color 0.3s' }}
              onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--color-accent)'; }}
              onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              Facebook
            </a>
          )}
          {photographer.whatsapp && (
            <a
              href={getWhatsAppHref(photographer.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-text-muted)', fontSize: '0.6rem', letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: 'var(--font-body)', textDecoration: 'none', transition: 'color 0.3s' }}
              onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--color-accent)'; }}
              onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              WhatsApp
            </a>
          )}
        </div>

        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: 'var(--font-body)', fontWeight: 300 }}>
          © {year} {photographer.name}
        </p>
      </div>
    </footer>
  );
}
