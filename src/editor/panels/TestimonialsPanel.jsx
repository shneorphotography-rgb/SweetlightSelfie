import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorPanelState } from '../EditorContext';
import ImageUpload from '../ImageUpload';
import PanelTabs from '../PanelTabs';
import TypographyControls, { FieldLabel } from '../TypographyControls';

const inputStyle = {
  width: '100%',
  minHeight: '44px',
  padding: '0.68rem 0.75rem',
  border: '1px solid var(--ssf-border)',
  borderRadius: '8px',
  fontFamily: 'Heebo, sans-serif',
  fontSize: '0.9rem',
  lineHeight: 1.6,
  color: 'var(--ssf-text)',
  background: 'var(--ssf-surface)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const primaryButtonStyle = {
  width: '100%',
  minHeight: '46px',
  padding: '0.7rem 1rem',
  border: '1px solid var(--ssf-violet)',
  borderRadius: '9px',
  background: 'var(--ssf-violet)',
  color: '#fff',
  fontFamily: 'Heebo, sans-serif',
  fontSize: '0.86rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const subtleButtonStyle = {
  minHeight: '44px',
  padding: '0.55rem 0.8rem',
  border: '1px solid var(--ssf-border)',
  borderRadius: '8px',
  background: 'var(--ssf-surface)',
  color: 'var(--ssf-text)',
  fontFamily: 'Heebo, sans-serif',
  fontSize: '0.82rem',
  cursor: 'pointer',
};

const dangerButtonStyle = {
  ...subtleButtonStyle,
  borderColor: 'color-mix(in srgb, var(--ssf-danger) 35%, var(--ssf-border))',
  color: 'var(--ssf-danger)',
  background: 'color-mix(in srgb, var(--ssf-danger) 8%, var(--ssf-surface))',
};

const focusField = (event) => {
  event.currentTarget.style.borderColor = 'var(--ssf-violet)';
  event.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ssf-violet) 18%, transparent)';
};

const blurField = (event) => {
  event.currentTarget.style.borderColor = 'var(--ssf-border)';
  event.currentTarget.style.boxShadow = 'none';
};

const compactText = (value, fallback) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

function Avatar({ review, size = 46 }) {
  if (review.image) {
    return (
      <img
        src={review.image}
        alt=""
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          border: '1px solid var(--ssf-border)',
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'var(--ssf-brand-soft)',
        color: 'var(--ssf-violet)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={Math.round(size * 0.48)} height={Math.round(size * 0.48)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21c.6-4.2 3-6.5 7.5-6.5s6.9 2.3 7.5 6.5" />
      </svg>
    </span>
  );
}

export default function TestimonialsPanel() {
  const { config, updateConfig } = useEditor();
  const testimonials = config.sections?.testimonials || {};
  const reviews = testimonials.reviews || [];
  const [activeTab, setActiveTab] = useEditorPanelState('testimonials', 'activeTab', 'items');
  const [selectedIndex, setSelectedIndex] = useEditorPanelState('testimonials', 'selectedIndex', null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const listRef = useRef(null);
  const listScrollTopRef = useRef(0);

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= reviews.length) {
      setSelectedIndex(reviews.length ? reviews.length - 1 : null);
      setConfirmingDelete(false);
    }
  }, [reviews.length, selectedIndex]);

  useEffect(() => {
    if (selectedIndex !== null) return undefined;

    const frame = window.requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listScrollTopRef.current;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedIndex]);

  const update = (index, field, value) => {
    const next = reviews.map((review, reviewIndex) => (
      reviewIndex === index ? { ...review, [field]: value, rating: 5 } : review
    ));
    updateConfig('sections.testimonials.reviews', next);
  };

  const openReview = (index) => {
    listScrollTopRef.current = listRef.current?.scrollTop || 0;
    setSelectedIndex(index);
    setConfirmingDelete(false);
  };

  const closeReview = () => {
    setSelectedIndex(null);
    setConfirmingDelete(false);
  };

  const addReview = () => {
    const nextIndex = reviews.length;
    updateConfig('sections.testimonials.reviews', [
      ...reviews,
      { name: '', text: '', rating: 5, image: '' },
    ]);
    setActiveTab('items');
    setSelectedIndex(nextIndex);
    setConfirmingDelete(false);
  };

  const deleteReview = () => {
    if (selectedIndex === null) return;
    updateConfig(
      'sections.testimonials.reviews',
      reviews.filter((_, reviewIndex) => reviewIndex !== selectedIndex),
    );
    closeReview();
  };

  const selectedReview = selectedIndex === null ? null : reviews[selectedIndex];

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PanelTabs
        tabs={[
          { id: 'items', label: 'המלצות', badge: reviews.length },
          { id: 'appearance', label: 'כותרת ועיצוב' },
        ]}
        value={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setConfirmingDelete(false);
        }}
        ariaLabel="עריכת אזור המלצות"
      />

      {activeTab === 'appearance' ? (
        <section aria-labelledby="testimonials-appearance-title">
          <div style={{ margin: '1.25rem 0 0.2rem' }}>
            <h3 id="testimonials-appearance-title" style={{ margin: 0, color: 'var(--ssf-text)', fontSize: '1rem', fontWeight: 600 }}>
              כותרת ועיצוב
            </h3>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--ssf-muted)', fontSize: '0.78rem', lineHeight: 1.6 }}>
              הכותרת, הכוכבים והטיפוגרפיה של אזור ההמלצות.
            </p>
          </div>

          <FieldLabel>כותרת האזור</FieldLabel>
          <input
            type="text"
            value={testimonials.title || ''}
            onChange={(event) => updateConfig('sections.testimonials.title', event.target.value)}
            placeholder="מה אומרים עליי"
            aria-label="כותרת אזור המלצות"
            style={inputStyle}
            onFocus={focusField}
            onBlur={blurField}
          />

          <label
            style={{
              minHeight: '48px',
              marginTop: '1rem',
              padding: '0.65rem 0.75rem',
              borderRadius: '9px',
              background: 'var(--ssf-brand-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              color: 'var(--ssf-text)',
              fontSize: '0.86rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={testimonials.showStars !== false}
              onChange={(event) => updateConfig('sections.testimonials.showStars', event.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--ssf-violet)', flexShrink: 0 }}
            />
            הצגת כוכבים בכל ההמלצות
          </label>

          <TypographyControls
            headingValue={testimonials.typography?.headingFamily}
            bodyValue={testimonials.typography?.bodyFamily}
            nameValue={testimonials.typography?.nameFamily}
            onHeadingChange={(value) => updateConfig('sections.testimonials.typography.headingFamily', value)}
            onBodyChange={(value) => updateConfig('sections.testimonials.typography.bodyFamily', value)}
            onNameChange={(value) => updateConfig('sections.testimonials.typography.nameFamily', value)}
            showName
          />
        </section>
      ) : (
        <section aria-labelledby="testimonials-items-title">
          {selectedReview ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  margin: '1rem 0 1.25rem',
                  paddingBottom: '0.85rem',
                  borderBottom: '1px solid var(--ssf-border)',
                }}
              >
                <button
                  type="button"
                  onClick={closeReview}
                  aria-label="חזרה לרשימת ההמלצות"
                  style={{
                    ...subtleButtonStyle,
                    borderColor: 'transparent',
                    background: 'var(--ssf-brand-soft)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <span aria-hidden="true">→</span>
                  כל ההמלצות
                </button>
                <span style={{ color: 'var(--ssf-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                  המלצה {selectedIndex + 1} מתוך {reviews.length}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <Avatar review={selectedReview} size={48} />
                <div style={{ minWidth: 0 }}>
                  <h3 id="testimonials-items-title" style={{ margin: 0, color: 'var(--ssf-text)', fontSize: '1rem', fontWeight: 600 }}>
                    עריכת המלצה
                  </h3>
                  <p style={{ margin: '0.15rem 0 0', color: 'var(--ssf-muted)', fontSize: '0.75rem' }}>
                    השינויים מתעדכנים מיד באתר.
                  </p>
                </div>
              </div>

              <FieldLabel>שם הלקוח או הזוג</FieldLabel>
              <input
                type="text"
                value={selectedReview.name || ''}
                onChange={(event) => update(selectedIndex, 'name', event.target.value)}
                placeholder="שם הלקוח"
                aria-label={`שם בהמלצה ${selectedIndex + 1}`}
                style={inputStyle}
                onFocus={focusField}
                onBlur={blurField}
              />

              <FieldLabel>טקסט ההמלצה</FieldLabel>
              <textarea
                value={selectedReview.text || ''}
                onChange={(event) => update(selectedIndex, 'text', event.target.value)}
                placeholder="טקסט ההמלצה..."
                aria-label={`טקסט המלצה ${selectedIndex + 1}`}
                rows={7}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '11rem' }}
                onFocus={focusField}
                onBlur={blurField}
              />

              <FieldLabel>תמונת הלקוח</FieldLabel>
              <ImageUpload
                onUpload={([path]) => update(selectedIndex, 'image', path)}
                preview={selectedReview.image}
                label={selectedReview.image ? 'החלפת תמונה' : 'הוספת תמונה'}
              />

              <div style={{ marginTop: '2rem', paddingTop: '1.1rem', borderTop: '1px solid var(--ssf-border)' }}>
                {!confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    style={{ ...dangerButtonStyle, width: '100%' }}
                  >
                    מחיקת ההמלצה
                  </button>
                ) : (
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      padding: '0.9rem',
                      borderRadius: '10px',
                      background: 'color-mix(in srgb, var(--ssf-danger) 9%, var(--ssf-surface))',
                      color: 'var(--ssf-danger)',
                    }}
                  >
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', lineHeight: 1.55 }}>
                      למחוק את ההמלצה? היא תוסר מאזור ההמלצות באתר.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                      <button type="button" onClick={deleteReview} style={{ ...dangerButtonStyle, background: 'var(--ssf-danger)', color: '#fff' }}>
                        כן, למחוק
                      </button>
                      <button type="button" onClick={() => setConfirmingDelete(false)} style={subtleButtonStyle}>
                        ביטול
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ margin: '1.25rem 0 0.85rem' }}>
                <h3 id="testimonials-items-title" style={{ margin: 0, color: 'var(--ssf-text)', fontSize: '1rem', fontWeight: 600 }}>
                  המלצות
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--ssf-muted)', fontSize: '0.78rem', lineHeight: 1.6 }}>
                  בחרו המלצה כדי לערוך את השם, הטקסט והתמונה שלה.
                </p>
              </div>

              {reviews.length ? (
                <div
                  ref={listRef}
                  role="list"
                  aria-label="רשימת המלצות"
                  style={{
                    maxHeight: 'min(58vh, 560px)',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    borderTop: '1px solid var(--ssf-border)',
                    borderBottom: '1px solid var(--ssf-border)',
                  }}
                >
                  {reviews.map((review, index) => (
                    <div key={index} role="listitem">
                      <button
                        type="button"
                        onClick={() => openReview(index)}
                        aria-label={`עריכת המלצה ${index + 1}: ${compactText(review.name, 'ללא שם')}`}
                        style={{
                          width: '100%',
                          minHeight: '78px',
                          padding: '0.7rem 0.25rem',
                          border: 0,
                          borderBottom: index === reviews.length - 1 ? 0 : '1px solid var(--ssf-border)',
                          background: 'var(--ssf-surface)',
                          color: 'var(--ssf-text)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          textAlign: 'right',
                          fontFamily: 'Heebo, sans-serif',
                          outline: 'none',
                        }}
                        onFocus={(event) => {
                          event.currentTarget.style.background = 'var(--ssf-brand-soft)';
                          event.currentTarget.style.boxShadow = 'inset 3px 0 0 var(--ssf-violet)';
                        }}
                        onBlur={(event) => {
                          event.currentTarget.style.background = 'var(--ssf-surface)';
                          event.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <Avatar review={review} />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <strong
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: '0.86rem',
                              fontWeight: 600,
                            }}
                          >
                            {compactText(review.name, 'המלצה ללא שם')}
                          </strong>
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '0.18rem',
                              color: 'var(--ssf-muted)',
                              fontSize: '0.73rem',
                            }}
                          >
                            {compactText(review.text, 'עדיין לא נכתב טקסט')}
                          </span>
                        </span>
                        <span aria-hidden="true" style={{ color: 'var(--ssf-muted)', fontSize: '1.2rem', flexShrink: 0 }}>
                          ‹
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '1.5rem 1rem',
                    borderRadius: '10px',
                    background: 'var(--ssf-brand-soft)',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ margin: 0, color: 'var(--ssf-text)', fontSize: '0.86rem', fontWeight: 600 }}>
                    אין עדיין המלצות
                  </p>
                  <p style={{ margin: '0.3rem 0 0', color: 'var(--ssf-muted)', fontSize: '0.76rem' }}>
                    הוסיפו המלצה ראשונה כדי לחזק את האמון בעבודה שלכם.
                  </p>
                </div>
              )}

              <div
                style={{
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 2,
                  padding: '0.85rem 0 max(0.85rem, env(safe-area-inset-bottom))',
                  background: 'linear-gradient(to bottom, transparent, var(--ssf-surface) 24%)',
                }}
              >
                <button type="button" onClick={addReview} style={primaryButtonStyle}>
                  + הוספת המלצה
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
