import { useEditor, useEditorPanelState } from '../EditorContext';
import PanelTabs from '../PanelTabs';
import TypographyControls, { FieldLabel } from '../TypographyControls';

const inputStyle = {
  width: '100%',
  padding: '0.65rem 0.75rem',
  border: '1.5px solid var(--ssf-border)',
  borderRadius: '4px',
  fontFamily: 'Heebo, sans-serif',
  fontSize: '0.9rem',
  color: 'var(--ssf-text)',
  background: 'var(--ssf-surface)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
  minHeight: '44px',
};

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        direction: type === 'email' || type === 'url' ? 'ltr' : 'rtl',
      }}
      onFocus={(event) => { event.target.style.borderColor = 'var(--ssf-violet)'; }}
      onBlur={(event) => { event.target.style.borderColor = 'var(--ssf-border)'; }}
    />
  );
}

function PanelHeading({ title, description }) {
  return (
    <header style={{ paddingBottom: '0.85rem', borderBottom: '1px solid var(--ssf-border)' }}>
      <h3 style={{ margin: 0, fontFamily: 'Heebo, sans-serif', fontSize: '1rem', fontWeight: 600, color: 'var(--ssf-text)' }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: '0.25rem 0 0', fontFamily: 'Heebo, sans-serif', fontSize: '0.76rem', lineHeight: 1.65, color: 'var(--ssf-muted)' }}>
          {description}
        </p>
      )}
    </header>
  );
}

export default function ContactPanel() {
  const { config, updateConfig } = useEditor();
  const [activeTab, setActiveTab] = useEditorPanelState('contact', 'activeTab', 'content');
  const contact = config.sections?.contact || {};
  const photographer = config.photographer || {};
  const tabs = [
    { id: 'content', label: 'תוכן' },
    { id: 'channels', label: 'ערוצי קשר' },
    { id: 'typography', label: 'טיפוגרפיה' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      <PanelTabs
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="אפשרויות עריכת אזור יצירת קשר"
      />

      <div role="tabpanel" tabIndex={0} style={{ outline: 'none' }}>
        {activeTab === 'content' && (
          <section>
            <PanelHeading
              title="תוכן אזור יצירת הקשר"
              description="הכותרת וההזמנה שמופיעות מעל טופס הפנייה."
            />

            <FieldLabel>כותרת סקשן</FieldLabel>
            <Input
              value={contact.title || ''}
              onChange={(event) => updateConfig('sections.contact.title', event.target.value)}
              placeholder="בואו נדבר"
            />

            <FieldLabel>כיתוב משנה</FieldLabel>
            <textarea
              value={contact.subtitle || ''}
              onChange={(event) => updateConfig('sections.contact.subtitle', event.target.value)}
              placeholder="רוצים לשמוע עוד? מלאו את הפרטים ואחזור אליכם בהקדם."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '8.5rem', direction: 'rtl' }}
              onFocus={(event) => { event.target.style.borderColor = 'var(--ssf-violet)'; }}
              onBlur={(event) => { event.target.style.borderColor = 'var(--ssf-border)'; }}
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                minHeight: '44px',
                marginTop: '1rem',
                padding: '0 0.15rem',
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.88rem',
                color: 'var(--ssf-text)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={contact.showWhatsApp !== false}
                onChange={(event) => updateConfig('sections.contact.showWhatsApp', event.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              הצג גם WhatsApp ליד אייקוני הקשר
            </label>
          </section>
        )}

        {activeTab === 'channels' && (
          <section>
            <PanelHeading
              title="ערוצי קשר"
              description="הפרטים שאליהם יגיעו הפניות והקישורים שיופיעו באתר."
            />

            <div style={{ marginTop: '0.9rem', padding: '0.75rem 0.85rem', borderRadius: '10px', background: 'var(--ssf-brand-soft)' }}>
              <p style={{ margin: 0, fontFamily: 'Heebo, sans-serif', fontSize: '0.75rem', color: 'var(--ssf-muted)', lineHeight: 1.7 }}>
                טופס יצירת הקשר נשלח לכתובת המייל שמוגדרת כאן.
              </p>
            </div>

            <FieldLabel>אימייל לקבלת פניות</FieldLabel>
            <Input
              type="email"
              value={photographer.email || ''}
              onChange={(event) => updateConfig('photographer.email', event.target.value)}
              placeholder="your@email.com"
            />

            <FieldLabel>טלפון</FieldLabel>
            <Input
              type="tel"
              value={photographer.phone || ''}
              onChange={(event) => updateConfig('photographer.phone', event.target.value)}
              placeholder="050-0000000"
            />

            <FieldLabel>ווצאפ (מספר בלבד)</FieldLabel>
            <Input
              type="tel"
              value={photographer.whatsapp || ''}
              onChange={(event) => updateConfig('photographer.whatsapp', event.target.value)}
              placeholder="0500000000"
            />

            <FieldLabel>אינסטגרם (לינק מלא)</FieldLabel>
            <Input
              type="url"
              value={photographer.instagram || ''}
              onChange={(event) => updateConfig('photographer.instagram', event.target.value)}
              placeholder="https://instagram.com/..."
            />

            <FieldLabel>פייסבוק (לינק מלא)</FieldLabel>
            <Input
              type="url"
              value={photographer.facebook || ''}
              onChange={(event) => updateConfig('photographer.facebook', event.target.value)}
              placeholder="https://facebook.com/..."
            />
          </section>
        )}

        {activeTab === 'typography' && (
          <section>
            <PanelHeading
              title="טיפוגרפיה"
              description="הפונטים לכותרת ולטקסט באזור יצירת הקשר."
            />

            <TypographyControls
              headingValue={contact.typography?.headingFamily}
              bodyValue={contact.typography?.bodyFamily}
              onHeadingChange={(value) => updateConfig('sections.contact.typography.headingFamily', value)}
              onBodyChange={(value) => updateConfig('sections.contact.typography.bodyFamily', value)}
            />
          </section>
        )}
      </div>
    </div>
  );
}
