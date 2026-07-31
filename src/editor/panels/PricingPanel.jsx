import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorPanelState } from '../EditorContext';
import ImageUpload from '../ImageUpload';
import PanelTabs from '../PanelTabs';
import TypographyControls, { FieldLabel } from '../TypographyControls';

const FONT_FAMILY = 'Heebo, sans-serif';

const inputStyle = {
  width: '100%',
  minHeight: '44px',
  padding: '0.68rem 0.75rem',
  border: '1px solid var(--ssf-border)',
  borderRadius: '8px',
  background: 'var(--ssf-surface)',
  color: 'var(--ssf-text)',
  fontFamily: FONT_FAMILY,
  fontSize: '0.88rem',
  lineHeight: 1.55,
  outline: 'none',
  boxSizing: 'border-box',
};

const buttonStyle = {
  minHeight: '44px',
  padding: '0.58rem 0.8rem',
  border: '1px solid var(--ssf-border)',
  borderRadius: '8px',
  background: 'var(--ssf-surface)',
  color: 'var(--ssf-text)',
  fontFamily: FONT_FAMILY,
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const primaryButtonStyle = {
  ...buttonStyle,
  borderColor: 'var(--ssf-violet)',
  background: 'var(--ssf-violet)',
  color: '#fff',
  fontWeight: 600,
};

const dangerButtonStyle = {
  ...buttonStyle,
  borderColor: 'color-mix(in srgb, var(--ssf-danger) 38%, var(--ssf-border))',
  color: 'var(--ssf-danger)',
};

const focusField = (event) => {
  event.currentTarget.style.borderColor = 'var(--ssf-violet)';
  event.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ssf-violet) 14%, transparent)';
};

const blurField = (event) => {
  event.currentTarget.style.borderColor = 'var(--ssf-border)';
  event.currentTarget.style.boxShadow = 'none';
};

const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const newPackage = () => ({
  id: createId('package'),
  label: 'חבילה חדשה',
  title: 'שם החבילה',
  price: '',
  currency: '₪',
  priceNote: 'כולל מע״מ',
  description: '',
  features: [],
  images: [],
  featured: false,
});

const newAddon = () => ({
  id: createId('addon'),
  title: 'שירות חדש',
  price: '',
  currency: '₪',
  priceNote: '',
  description: '',
  features: [],
  images: [],
});

function PanelHeading({ title, description }) {
  return (
    <header style={{ margin: '1.15rem 0 0.95rem' }}>
      <h3 style={{ margin: 0, color: 'var(--ssf-text)', fontFamily: FONT_FAMILY, fontSize: '1rem', fontWeight: 600 }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: '0.28rem 0 0', color: 'var(--ssf-muted)', fontFamily: FONT_FAMILY, fontSize: '0.76rem', lineHeight: 1.65 }}>
          {description}
        </p>
      )}
    </header>
  );
}

function Input({ value = '', onChange, placeholder, type = 'text', dir = 'rtl', ariaLabel }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      dir={dir}
      aria-label={ariaLabel}
      style={inputStyle}
      onFocus={focusField}
      onBlur={blurField}
    />
  );
}

function Textarea({ value = '', onChange, placeholder, rows = 5, ariaLabel }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      aria-label={ariaLabel}
      style={{ ...inputStyle, minHeight: `${rows * 1.55 + 1.2}rem`, resize: 'vertical' }}
      onFocus={focusField}
      onBlur={blurField}
    />
  );
}

function FeaturesEditor({ features = [], onChange }) {
  const [confirmIndex, setConfirmIndex] = useState(null);

  useEffect(() => {
    if (confirmIndex !== null && confirmIndex >= features.length) setConfirmIndex(null);
  }, [confirmIndex, features.length]);

  const updateFeature = (index, value) => {
    onChange(features.map((feature, featureIndex) => (featureIndex === index ? value : feature)));
  };

  const removeFeature = (index) => {
    onChange(features.filter((_, featureIndex) => featureIndex !== index));
    setConfirmIndex(null);
  };

  return (
    <div>
      <FieldLabel>מה כלול</FieldLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {features.map((feature, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.45rem', alignItems: 'center' }}>
            <Input
              value={feature}
              onChange={(value) => updateFeature(index, value)}
              placeholder="למשל: עריכה מקצועית לכל התמונות"
              ariaLabel={`סעיף כלול ${index + 1}`}
            />
            {confirmIndex === index ? (
              <button
                type="button"
                onClick={() => removeFeature(index)}
                style={{ ...dangerButtonStyle, minWidth: '86px', paddingInline: '0.55rem' }}
              >
                אישור מחיקה
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmIndex(index)}
                aria-label={`מחיקת סעיף ${index + 1}`}
                style={{ ...buttonStyle, color: 'var(--ssf-muted)', paddingInline: '0.65rem' }}
              >
                הסרה
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...features, ''])}
        style={{ ...buttonStyle, width: '100%', marginTop: '0.65rem', borderStyle: 'dashed' }}
      >
        + הוספת סעיף לחבילה
      </button>
    </div>
  );
}

function ImagesEditor({ images = [], title, onChange }) {
  const [confirmIndex, setConfirmIndex] = useState(null);

  useEffect(() => {
    if (confirmIndex !== null && confirmIndex >= images.length) setConfirmIndex(null);
  }, [confirmIndex, images.length]);

  const removeImage = (index) => {
    onChange(images.filter((_, imageIndex) => imageIndex !== index));
    setConfirmIndex(null);
  };

  return (
    <div>
      <FieldLabel>תמונות</FieldLabel>
      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.55rem', marginBottom: '0.7rem' }}>
          {images.map((src, index) => (
            <figure key={`${src}-${index}`} style={{ margin: 0, position: 'relative', minWidth: 0 }}>
              <img
                src={src}
                alt={`${title || 'שירות'} — תמונה ${index + 1}`}
                style={{ width: '100%', height: '104px', display: 'block', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--ssf-border)' }}
              />
              <button
                type="button"
                onClick={() => (confirmIndex === index ? removeImage(index) : setConfirmIndex(index))}
                aria-label={confirmIndex === index ? `אישור הסרת תמונה ${index + 1}` : `הסרת תמונה ${index + 1}`}
                style={{
                  ...buttonStyle,
                  position: 'absolute',
                  insetInlineEnd: '6px',
                  insetBlockEnd: '6px',
                  minHeight: '34px',
                  padding: '0.3rem 0.55rem',
                  borderColor: confirmIndex === index ? 'var(--ssf-danger)' : 'rgba(255,255,255,0.78)',
                  background: confirmIndex === index ? 'var(--ssf-danger)' : 'rgba(20,24,35,0.82)',
                  color: '#fff',
                  fontSize: '0.7rem',
                }}
              >
                {confirmIndex === index ? 'לאשר' : 'הסרה'}
              </button>
            </figure>
          ))}
        </div>
      )}
      <ImageUpload
        multiple
        label={images.length ? 'הוספת תמונות נוספות' : 'הוספת תמונות'}
        onUpload={(paths) => onChange([...images, ...paths])}
      />
      <p style={{ margin: '0.45rem 0 0', color: 'var(--ssf-muted)', fontFamily: FONT_FAMILY, fontSize: '0.7rem', lineHeight: 1.55 }}>
        אפשר לבחור כמה תמונות יחד. הסדר שלהן בגלריה הוא סדר ההוספה.
      </p>
    </div>
  );
}

function ItemEditor({ item, index, total, kind, onChange, onBack, onDelete, onMove }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPackage = kind === 'packages';

  useEffect(() => setConfirmDelete(false), [index, item?.id]);

  const updateField = (field, value) => onChange({ ...item, [field]: value });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', margin: '1rem 0', paddingBottom: '0.8rem', borderBottom: '1px solid var(--ssf-border)' }}>
        <button type="button" onClick={onBack} style={{ ...buttonStyle, borderColor: 'transparent', background: 'var(--ssf-brand-soft)' }}>
          → חזרה לרשימה
        </button>
        <span style={{ color: 'var(--ssf-muted)', fontFamily: FONT_FAMILY, fontSize: '0.74rem' }}>
          {index + 1} מתוך {total}
        </span>
      </div>

      <PanelHeading
        title={isPackage ? 'עריכת חבילה' : 'עריכת שירות נוסף'}
        description="כל שינוי נשמר ומתעדכן מיד באתר."
      />

      {isPackage && (
        <>
          <FieldLabel>תווית קטנה</FieldLabel>
          <Input value={item.label || ''} onChange={(value) => updateField('label', value)} placeholder="החבילה המרכזית" />
        </>
      )}

      <FieldLabel>{isPackage ? 'שם החבילה' : 'שם השירות'}</FieldLabel>
      <Input value={item.title || ''} onChange={(value) => updateField('title', value)} placeholder={isPackage ? 'צילום סטילס מלא' : 'אלבומים מודפסים'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 78px', gap: '0.55rem' }}>
        <div>
          <FieldLabel>מחיר</FieldLabel>
          <Input value={item.price || ''} onChange={(value) => updateField('price', value)} placeholder="7,500" dir="ltr" ariaLabel="מחיר" />
        </div>
        <div>
          <FieldLabel>מטבע</FieldLabel>
          <Input value={item.currency || ''} onChange={(value) => updateField('currency', value)} placeholder="₪" ariaLabel="מטבע" />
        </div>
      </div>

      <FieldLabel>הערה ליד המחיר</FieldLabel>
      <Input value={item.priceNote || ''} onChange={(value) => updateField('priceNote', value)} placeholder="כולל מע״מ" />

      <FieldLabel>תיאור</FieldLabel>
      <Textarea value={item.description || ''} onChange={(value) => updateField('description', value)} placeholder="ספרו בקצרה מה מקבלים..." rows={6} />

      <FeaturesEditor features={Array.isArray(item.features) ? item.features : []} onChange={(value) => updateField('features', value)} />
      <ImagesEditor images={Array.isArray(item.images) ? item.images : []} title={item.title} onChange={(value) => updateField('images', value)} />

      {isPackage && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minHeight: '48px', marginTop: '1rem', padding: '0.65rem 0.75rem', borderRadius: '8px', background: 'var(--ssf-brand-soft)', color: 'var(--ssf-text)', fontFamily: FONT_FAMILY, fontSize: '0.84rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={item.featured === true}
            onChange={(event) => updateField('featured', event.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--ssf-violet)' }}
          />
          הדגשת החבילה כחבילה מרכזית
        </label>
      )}

      {total > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', marginTop: '1.15rem' }}>
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} style={{ ...buttonStyle, opacity: index === 0 ? 0.45 : 1 }}>
            העברה למעלה
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} style={{ ...buttonStyle, opacity: index === total - 1 ? 0.45 : 1 }}>
            העברה למטה
          </button>
        </div>
      )}

      <div style={{ marginTop: '1.4rem', paddingTop: '1rem', borderTop: '1px solid var(--ssf-border)' }}>
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...dangerButtonStyle, width: '100%' }}>
            {isPackage ? 'מחיקת החבילה' : 'מחיקת השירות'}
          </button>
        ) : (
          <div role="alert" style={{ padding: '0.85rem', borderRadius: '9px', border: '1px solid color-mix(in srgb, var(--ssf-danger) 38%, var(--ssf-border))' }}>
            <p style={{ margin: '0 0 0.7rem', color: 'var(--ssf-danger)', fontFamily: FONT_FAMILY, fontSize: '0.8rem', lineHeight: 1.55 }}>
              {isPackage ? 'למחוק את החבילה מהצעת המחיר?' : 'למחוק את השירות מהצעת המחיר?'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button type="button" onClick={onDelete} style={{ ...dangerButtonStyle, background: 'var(--ssf-danger)', color: '#fff' }}>
                כן, למחוק
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} style={buttonStyle}>
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CollectionEditor({ kind, items, selectedIndex, onSelect, onChange }) {
  const listRef = useRef(null);
  const scrollTopRef = useRef(0);
  const isPackage = kind === 'packages';

  useEffect(() => {
    if (selectedIndex !== null) return undefined;
    const frame = requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = scrollTopRef.current;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= items.length) onSelect(items.length ? items.length - 1 : null);
  }, [items.length, onSelect, selectedIndex]);

  const openItem = (index) => {
    scrollTopRef.current = listRef.current?.scrollTop || 0;
    onSelect(index);
  };

  const addItem = () => {
    const next = [...items, isPackage ? newPackage() : newAddon()];
    onChange(next);
    onSelect(next.length - 1);
  };

  const updateItem = (nextItem) => {
    onChange(items.map((item, index) => (index === selectedIndex ? nextItem : item)));
  };

  const deleteItem = () => {
    onChange(items.filter((_, index) => index !== selectedIndex));
    onSelect(null);
  };

  const moveItem = (direction) => {
    const targetIndex = selectedIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    [next[selectedIndex], next[targetIndex]] = [next[targetIndex], next[selectedIndex]];
    onChange(next);
    onSelect(targetIndex);
  };

  const selectedItem = selectedIndex === null ? null : items[selectedIndex];
  if (selectedItem) {
    return (
      <ItemEditor
        item={selectedItem}
        index={selectedIndex}
        total={items.length}
        kind={kind}
        onChange={updateItem}
        onBack={() => onSelect(null)}
        onDelete={deleteItem}
        onMove={moveItem}
      />
    );
  }

  return (
    <div>
      <PanelHeading
        title={isPackage ? 'חבילות צילום' : 'שירותים נוספים'}
        description={isPackage ? 'בחרו חבילה כדי לערוך את המחיר, התוכן והתמונות שלה.' : 'שירותים שהלקוחות יכולים לצרף לחבילת הצילום.'}
      />

      {items.length > 0 ? (
        <div ref={listRef} role="list" style={{ maxHeight: 'min(55vh, 520px)', overflowY: 'auto', borderTop: '1px solid var(--ssf-border)', borderBottom: '1px solid var(--ssf-border)' }}>
          {items.map((item, index) => (
            <button
              key={item.id || index}
              type="button"
              role="listitem"
              onClick={() => openItem(index)}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '0.7rem 0.2rem',
                border: 0,
                borderBottom: index === items.length - 1 ? 0 : '1px solid var(--ssf-border)',
                background: 'var(--ssf-surface)',
                color: 'var(--ssf-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textAlign: 'right',
                cursor: 'pointer',
                fontFamily: FONT_FAMILY,
              }}
            >
              {item.images?.[0] ? (
                <img src={item.images[0]} alt="" style={{ width: '56px', height: '56px', borderRadius: '7px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <span aria-hidden="true" style={{ width: '56px', height: '56px', borderRadius: '7px', background: 'var(--ssf-brand-soft)', display: 'grid', placeItems: 'center', color: 'var(--ssf-violet)', flexShrink: 0, fontSize: '1.25rem' }}>
                  ₪
                </span>
              )}
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 600 }}>
                  {item.title || (isPackage ? 'חבילה ללא שם' : 'שירות ללא שם')}
                </strong>
                <span style={{ display: 'block', marginTop: '0.18rem', color: 'var(--ssf-muted)', fontSize: '0.73rem' }}>
                  {item.price ? `${item.currency || '₪'}${item.price}` : 'המחיר טרם הוגדר'}
                </span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--ssf-muted)', fontSize: '1.2rem' }}>‹</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ padding: '1.4rem 1rem', borderRadius: '9px', background: 'var(--ssf-brand-soft)', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--ssf-text)', fontFamily: FONT_FAMILY, fontSize: '0.84rem', fontWeight: 600 }}>
            {isPackage ? 'אין עדיין חבילות' : 'אין עדיין שירותים נוספים'}
          </p>
        </div>
      )}

      <button type="button" onClick={addItem} style={{ ...primaryButtonStyle, width: '100%', marginTop: '0.85rem' }}>
        {isPackage ? '+ הוספת חבילה' : '+ הוספת שירות נוסף'}
      </button>
    </div>
  );
}

export default function PricingPanel() {
  const { config, updateConfig } = useEditor();
  const pricing = config.sections?.pricing || {};
  const packages = Array.isArray(pricing.packages) ? pricing.packages : pricing.package ? [pricing.package] : [];
  const addons = Array.isArray(pricing.addons) ? pricing.addons : Array.isArray(pricing.services) ? pricing.services : [];
  const [activeTab, setActiveTab] = useEditorPanelState('pricing', 'activeTab', 'content');
  const [selectedPackage, setSelectedPackage] = useEditorPanelState('pricing', 'selectedPackage', null);
  const [selectedAddon, setSelectedAddon] = useEditorPanelState('pricing', 'selectedAddon', null);

  return (
    <div dir="rtl" style={{ fontFamily: FONT_FAMILY }}>
      <PanelTabs
        tabs={[
          { id: 'content', label: 'פתיח' },
          { id: 'packages', label: 'חבילות', badge: packages.length },
          { id: 'addons', label: 'שירותים', badge: addons.length },
          { id: 'typography', label: 'טיפוגרפיה' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="עריכת אזור הצעת מחיר"
      />

      {activeTab === 'content' && (
        <section>
          <PanelHeading title="הצעת המחיר" description="הכותרת, ההסבר והפעולה שמסיימת את האזור." />

          <FieldLabel>כיתוב עליון קטן</FieldLabel>
          <Input value={pricing.eyebrow || ''} onChange={(value) => updateConfig('sections.pricing.eyebrow', value)} placeholder="הצעת מחיר" />

          <FieldLabel>כותרת האזור</FieldLabel>
          <Input value={pricing.title || ''} onChange={(value) => updateConfig('sections.pricing.title', value)} placeholder="צילום סטילס בחתונות" />

          <FieldLabel>פתיח</FieldLabel>
          <Textarea value={pricing.intro || ''} onChange={(value) => updateConfig('sections.pricing.intro', value)} placeholder="כמה מילים שמכניסות את הלקוחות להצעה..." rows={5} />

          <FieldLabel>כותרת השירותים הנוספים</FieldLabel>
          <Input value={pricing.addonsTitle || ''} onChange={(value) => updateConfig('sections.pricing.addonsTitle', value)} placeholder="שירותים שאפשר להוסיף" />

          <FieldLabel>הערה ותנאים</FieldLabel>
          <Textarea value={pricing.terms || ''} onChange={(value) => updateConfig('sections.pricing.terms', value)} placeholder="הערה לגבי המחירים או תנאי החבילה" rows={3} />

          <FieldLabel>טקסט הכפתור</FieldLabel>
          <Input value={pricing.ctaLabel || ''} onChange={(value) => updateConfig('sections.pricing.ctaLabel', value)} placeholder="בואו נבדוק את התאריך שלכם" />

          <FieldLabel>קישור הכפתור</FieldLabel>
          <Input value={pricing.ctaHref || ''} onChange={(value) => updateConfig('sections.pricing.ctaHref', value)} placeholder="#contact" dir="ltr" />
        </section>
      )}

      {activeTab === 'packages' && (
        <CollectionEditor
          kind="packages"
          items={packages}
          selectedIndex={selectedPackage}
          onSelect={setSelectedPackage}
          onChange={(value) => updateConfig('sections.pricing.packages', value)}
        />
      )}

      {activeTab === 'addons' && (
        <CollectionEditor
          kind="addons"
          items={addons}
          selectedIndex={selectedAddon}
          onSelect={setSelectedAddon}
          onChange={(value) => updateConfig('sections.pricing.addons', value)}
        />
      )}

      {activeTab === 'typography' && (
        <section>
          <PanelHeading title="טיפוגרפיה" description="הפונטים לכותרות ולטקסטים באזור הצעת המחיר." />
          <TypographyControls
            headingValue={pricing.typography?.headingFamily}
            bodyValue={pricing.typography?.bodyFamily}
            accentValue={pricing.typography?.accentFamily}
            onHeadingChange={(value) => updateConfig('sections.pricing.typography.headingFamily', value)}
            onBodyChange={(value) => updateConfig('sections.pricing.typography.bodyFamily', value)}
            onAccentChange={(value) => updateConfig('sections.pricing.typography.accentFamily', value)}
            accentLabel="פונט תוויות ומחירים"
            showAccent
          />
        </section>
      )}
    </div>
  );
}
