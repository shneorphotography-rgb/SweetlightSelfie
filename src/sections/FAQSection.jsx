import { useState } from 'react';
import SoftReveal from '../components/SoftReveal';
import { getSectionBackground, getSectionTypography } from '../utils/sectionStyles';
import { normalizeMultilineText } from '../utils/textFormatting';

export default function FAQSection({ data, config }) {
  const [openIndex, setOpenIndex] = useState(null);

  if (!data || !data.enabled || !data.questions?.length) return null;
  const typography = getSectionTypography(config, 'faq');

  return (
    <section
      id="faq"
      style={{ backgroundColor: getSectionBackground(data.backgroundColor || 'background'), padding: '6rem 1.5rem' }}
    >
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        <SoftReveal style={{ textAlign: 'center', marginBottom: '3.25rem' }} variant="soft-open">
          <h2 className="section-title" style={{ fontFamily: typography.headingFamily }}>{data.title}</h2>
          <div className="section-line" />
        </SoftReveal>

        <div className="faq-list">
          {data.questions.map((q, i) => (
            <SoftReveal
              key={i}
              className={`faq-item-frame${openIndex === i ? ' open' : ''}`}
              variant="card"
              delay={i * 0.06}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                style={{
                  width: '100%',
                  padding: '1.58rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'right',
                  gap: '1rem',
                }}
              >
                <span className="faq-question" style={{ fontFamily: typography.headingFamily }}>{q.question}</span>
                <span style={{
                  fontSize: '1.45rem',
                  color: 'var(--color-accent)',
                  transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0)',
                  transition: 'transform 0.35s ease',
                  flexShrink: 0,
                  lineHeight: 1,
                }}>
                  +
                </span>
              </button>

              <div style={{
                maxHeight: openIndex === i ? '1000px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.4s ease, opacity 0.4s ease',
                opacity: openIndex === i ? 1 : 0,
              }}>
                <p className="faq-answer-text" style={{ fontFamily: typography.bodyFamily }}>
                  {normalizeMultilineText(q.answer)}
                </p>
              </div>
            </SoftReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
