export default function AccordionSection({ title, subtitle, defaultOpen = false, children }) {
  return (
    <details
      open={defaultOpen}
      style={{
        border: '1px solid var(--ssf-border)',
        borderRadius: '12px',
        background: 'var(--ssf-surface)',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          listStyle: 'none',
          cursor: 'pointer',
          padding: '0.95rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.8rem',
          userSelect: 'none',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.92rem', color: 'var(--ssf-text)', fontWeight: 500 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.74rem', color: 'var(--ssf-muted)', marginTop: '0.2rem', lineHeight: 1.6 }}>
              {subtitle}
            </div>
          )}
        </div>
        <span style={{ color: 'var(--ssf-violet)', fontSize: '0.8rem', flexShrink: 0 }}>▾</span>
      </summary>

      <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--ssf-border)' }}>
        <div style={{ paddingTop: '0.25rem' }}>
          {children}
        </div>
      </div>
    </details>
  );
}
