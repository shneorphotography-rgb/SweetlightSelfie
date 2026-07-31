import { useState } from 'react';
import SoftReveal from '../components/SoftReveal';
import { getWhatsAppHref, submitContactForm } from '../utils/contact';
import { getSectionBackground, getSectionTypography } from '../utils/sectionStyles';

const INITIAL_FORM = { name: '', email: '', phone: '', date: '', message: '' };

export default function ContactSection({ data, photographer, config }) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const typography = getSectionTypography(config, 'contact');

  if (!data || !data.enabled) return null;

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const contactLinks = [
    {
      id: 'email',
      href: photographer.email ? `mailto:${photographer.email}` : '',
      label: 'Email',
      external: false,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16v12H4z" />
          <path d="m4 8 8 6 8-6" />
        </svg>
      ),
    },
    {
      id: 'instagram',
      href: photographer.instagram || '',
      label: 'Instagram',
      external: true,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="4" ry="4" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      id: 'facebook',
      href: photographer.facebook || '',
      label: 'Facebook',
      external: true,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.5 21v-7h2.3l.4-3h-2.7V9.1c0-.9.2-1.6 1.5-1.6H16V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.3-3.8 4V11H7.7v3H10V21h3.5z" />
        </svg>
      ),
    },
    {
      id: 'whatsapp',
      href: data.showWhatsApp && photographer.whatsapp
        ? getWhatsAppHref(photographer.whatsapp, 'היי, אני מעוניין/ת בשירותי צילום')
        : '',
      label: 'WhatsApp',
      external: true,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
  ].filter((link) => link.href);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: 'idle', message: '' });

    try {
      await submitContactForm(photographer.email, formData);
      setStatus({ type: 'success', message: 'תודה, ההודעה נשלחה בהצלחה ואחזור אליכם בהקדם.' });
      setFormData(INITIAL_FORM);
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'שליחת ההודעה נכשלה. נסו שוב.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="contact"
      style={{ backgroundColor: getSectionBackground(data.backgroundColor || 'surface'), padding: '5rem 1.5rem' }}
    >
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        <SoftReveal style={{ textAlign: 'center', marginBottom: '2.4rem' }} variant="soft-open">
          <span className="section-label" style={{ fontFamily: typography.bodyFamily }}>Contact</span>
          <h2 className="section-title" style={{ fontFamily: typography.headingFamily }}>{data.title}</h2>
          <div className="section-line" />
          {data.subtitle && (
            <p className="contact-note" style={{ fontFamily: typography.bodyFamily }}>
              {data.subtitle}
            </p>
          )}
        </SoftReveal>

        <div className="contact-grid-tight">
          <SoftReveal className="subtle-frame contact-block contact-block--info" variant="drift-left" delay={0.06}>
            <div className="contact-info-title" style={{ fontFamily: typography.headingFamily }}>פרטי ההתקשרות</div>

            <div className="contact-icon-list">
              {contactLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="contact-icon-link"
                  aria-label={link.label}
                  title={link.label}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </SoftReveal>

          <SoftReveal as="form" onSubmit={handleSubmit} className="subtle-frame contact-block contact-stack" variant="drift-right" delay={0.12}>
            <div>
              <label className="elegant-label" style={{ fontFamily: typography.bodyFamily }}>שם מלא</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="elegant-input"
                placeholder="השם שלך"
              />
            </div>

            <div className="contact-form-grid">
              <div>
                <label className="elegant-label" style={{ fontFamily: typography.bodyFamily }}>אימייל</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="elegant-input"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="elegant-label" style={{ fontFamily: typography.bodyFamily }}>טלפון</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="elegant-input"
                  placeholder="050-0000000"
                />
              </div>
            </div>

            <div>
              <label className="elegant-label" style={{ fontFamily: typography.bodyFamily }}>תאריך האירוע</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="elegant-input"
              />
            </div>

            <div>
              <label className="elegant-label" style={{ fontFamily: typography.bodyFamily }}>הודעה</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows="4"
                className="elegant-input"
                style={{ resize: 'none', minHeight: '8.5rem' }}
                placeholder="ספרו לי על האירוע שלכם..."
              />
            </div>

            <div className="contact-submit-row">
              {status.type !== 'idle' && (
                <p style={{ color: status.type === 'success' ? 'var(--color-success)' : 'var(--color-error)', fontSize: '0.82rem', letterSpacing: '0.03em', marginInlineEnd: '1rem', fontFamily: typography.bodyFamily }}>
                  {status.message}
                </p>
              )}
              <button type="submit" className="elegant-btn" disabled={submitting}>
                {submitting ? 'שולח...' : 'שלח הודעה'}
              </button>
            </div>
          </SoftReveal>
        </div>
      </div>
    </section>
  );
}
