import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorPanelState } from '../EditorContext';
import PanelTabs from '../PanelTabs';
import TypographyControls, { FieldLabel } from '../TypographyControls';
import { normalizeMultilineText } from '../../utils/textFormatting';

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
  const text = normalizeMultilineText(value).replace(/\s+/g, ' ').trim();
  return text || fallback;
};

export default function FAQPanel() {
  const { config, updateConfig } = useEditor();
  const faq = config.sections?.faq || {};
  const questions = faq.questions || [];
  const [activeTab, setActiveTab] = useEditorPanelState('faq', 'activeTab', 'items');
  const [selectedIndex, setSelectedIndex] = useEditorPanelState('faq', 'selectedIndex', null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const listRef = useRef(null);
  const listScrollTopRef = useRef(0);

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= questions.length) {
      setSelectedIndex(questions.length ? questions.length - 1 : null);
      setConfirmingDelete(false);
    }
  }, [questions.length, selectedIndex]);

  useEffect(() => {
    if (selectedIndex !== null) return undefined;

    const frame = window.requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listScrollTopRef.current;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedIndex]);

  const update = (index, field, value) => {
    const next = questions.map((question, questionIndex) => (
      questionIndex === index ? { ...question, [field]: value } : question
    ));
    updateConfig('sections.faq.questions', next);
  };

  const openQuestion = (index) => {
    listScrollTopRef.current = listRef.current?.scrollTop || 0;
    setSelectedIndex(index);
    setConfirmingDelete(false);
  };

  const closeQuestion = () => {
    setSelectedIndex(null);
    setConfirmingDelete(false);
  };

  const addQuestion = () => {
    const nextIndex = questions.length;
    updateConfig('sections.faq.questions', [...questions, { question: '', answer: '' }]);
    setActiveTab('items');
    setSelectedIndex(nextIndex);
    setConfirmingDelete(false);
  };

  const deleteQuestion = () => {
    if (selectedIndex === null) return;
    updateConfig(
      'sections.faq.questions',
      questions.filter((_, questionIndex) => questionIndex !== selectedIndex),
    );
    closeQuestion();
  };

  const selectedQuestion = selectedIndex === null ? null : questions[selectedIndex];

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PanelTabs
        tabs={[
          { id: 'items', label: 'שאלות', badge: questions.length },
          { id: 'appearance', label: 'כותרת ועיצוב' },
        ]}
        value={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setConfirmingDelete(false);
        }}
        ariaLabel="עריכת אזור שאלות נפוצות"
      />

      {activeTab === 'appearance' ? (
        <section aria-labelledby="faq-appearance-title">
          <div style={{ margin: '1.25rem 0 0.2rem' }}>
            <h3 id="faq-appearance-title" style={{ margin: 0, color: 'var(--ssf-text)', fontSize: '1rem', fontWeight: 600 }}>
              כותרת ועיצוב
            </h3>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--ssf-muted)', fontSize: '0.78rem', lineHeight: 1.6 }}>
              הכותרת והטיפוגרפיה של אזור השאלות באתר.
            </p>
          </div>

          <FieldLabel>כותרת האזור</FieldLabel>
          <input
            type="text"
            value={faq.title || ''}
            onChange={(event) => updateConfig('sections.faq.title', event.target.value)}
            placeholder="שאלות נפוצות"
            aria-label="כותרת אזור שאלות נפוצות"
            style={inputStyle}
            onFocus={focusField}
            onBlur={blurField}
          />

          <TypographyControls
            headingValue={faq.typography?.headingFamily}
            bodyValue={faq.typography?.bodyFamily}
            onHeadingChange={(value) => updateConfig('sections.faq.typography.headingFamily', value)}
            onBodyChange={(value) => updateConfig('sections.faq.typography.bodyFamily', value)}
          />
        </section>
      ) : (
        <section aria-labelledby="faq-items-title">
          {selectedQuestion ? (
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
                  onClick={closeQuestion}
                  aria-label="חזרה לרשימת השאלות"
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
                  כל השאלות
                </button>
                <span style={{ color: 'var(--ssf-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                  שאלה {selectedIndex + 1} מתוך {questions.length}
                </span>
              </div>

              <h3 id="faq-items-title" style={{ margin: '0 0 0.2rem', color: 'var(--ssf-text)', fontSize: '1rem', fontWeight: 600 }}>
                עריכת שאלה
              </h3>
              <p style={{ margin: '0 0 1rem', color: 'var(--ssf-muted)', fontSize: '0.78rem', lineHeight: 1.6 }}>
                השינויים מתעדכנים מיד בתצוגת האתר.
              </p>

              <FieldLabel>השאלה</FieldLabel>
              <input
                type="text"
                value={selectedQuestion.question || ''}
                onChange={(event) => update(selectedIndex, 'question', event.target.value)}
                placeholder="השאלה..."
                aria-label={`נוסח שאלה ${selectedIndex + 1}`}
                style={inputStyle}
                onFocus={focusField}
                onBlur={blurField}
              />

              <FieldLabel>התשובה</FieldLabel>
              <textarea
                value={normalizeMultilineText(selectedQuestion.answer)}
                onChange={(event) => update(selectedIndex, 'answer', event.target.value)}
                placeholder="התשובה..."
                aria-label={`תשובה לשאלה ${selectedIndex + 1}`}
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '12rem' }}
                onFocus={focusField}
                onBlur={blurField}
              />

              <div style={{ marginTop: '2rem', paddingTop: '1.1rem', borderTop: '1px solid var(--ssf-border)' }}>
                {!confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    style={{ ...dangerButtonStyle, width: '100%' }}
                  >
                    מחיקת השאלה
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
                      למחוק את השאלה? היא תוסר מאזור השאלות באתר.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                      <button type="button" onClick={deleteQuestion} style={{ ...dangerButtonStyle, background: 'var(--ssf-danger)', color: '#fff' }}>
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
                <h3 id="faq-items-title" style={{ margin: 0, color: 'var(--ssf-text)', fontSize: '1rem', fontWeight: 600 }}>
                  שאלות ותשובות
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--ssf-muted)', fontSize: '0.78rem', lineHeight: 1.6 }}>
                  בחרו שאלה כדי לערוך אותה. כל שאלה מוצגת כאן בשורה קצרה.
                </p>
              </div>

              {questions.length ? (
                <div
                  ref={listRef}
                  role="list"
                  aria-label="רשימת שאלות נפוצות"
                  style={{
                    maxHeight: 'min(58vh, 560px)',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    borderTop: '1px solid var(--ssf-border)',
                    borderBottom: '1px solid var(--ssf-border)',
                  }}
                >
                  {questions.map((question, index) => (
                    <div key={index} role="listitem">
                      <button
                        type="button"
                        onClick={() => openQuestion(index)}
                        aria-label={`עריכת שאלה ${index + 1}: ${compactText(question.question, 'שאלה ללא כותרת')}`}
                        style={{
                          width: '100%',
                          minHeight: '76px',
                          padding: '0.75rem 0.25rem',
                          border: 0,
                          borderBottom: index === questions.length - 1 ? 0 : '1px solid var(--ssf-border)',
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
                        <span
                          aria-hidden="true"
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: 'var(--ssf-brand-soft)',
                            color: 'var(--ssf-violet)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          {index + 1}
                        </span>
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
                            {compactText(question.question, 'שאלה ללא כותרת')}
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
                            {compactText(question.answer, 'עדיין לא נכתבה תשובה')}
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
                    אין עדיין שאלות
                  </p>
                  <p style={{ margin: '0.3rem 0 0', color: 'var(--ssf-muted)', fontSize: '0.76rem' }}>
                    הוסיפו שאלה ראשונה וכתבו את התשובה במקום אחד.
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
                <button type="button" onClick={addQuestion} style={primaryButtonStyle}>
                  + הוספת שאלה
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
