import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Languages, Search } from 'lucide-react';
import { FONT_OPTIONS } from '../theme/designOptions';
import './about-design.css';

const baseLabelStyle = {
  fontFamily: 'Assistant, Heebo, sans-serif',
  fontSize: '0.72rem',
  letterSpacing: '0.01em',
  color: 'var(--ssf-muted)',
  marginBottom: '0.45rem',
  marginTop: '1.15rem',
  fontWeight: 650,
};

export function FieldLabel({ children }) {
  return <p style={baseLabelStyle}>{children}</p>;
}

function fontMatches(font, query) {
  if (!query) return true;
  const haystack = [
    font.label,
    font.labelHe,
    font.categoryHe,
    ...(font.supports || []),
  ].filter(Boolean).join(' ').toLocaleLowerCase('he');
  return haystack.includes(query.toLocaleLowerCase('he'));
}

function FontSupportBadge({ font }) {
  const hebrew = font.supports?.includes('he');
  return (
    <span className={`font-picker-language${hebrew ? ' supports-hebrew' : ''}`}>
      <Languages size={12} aria-hidden="true" />
      {hebrew ? 'עברית · English' : 'English'}
    </span>
  );
}

export function FontFamilySelect({
  value,
  onChange,
  allowBlank = true,
  englishOnly = false,
  sampleText,
  ariaLabel = 'בחירת פונט',
}) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const fonts = useMemo(() => (
    FONT_OPTIONS.filter((font) => !englishOnly || font.supports?.includes('en'))
  ), [englishOnly]);
  const filteredFonts = useMemo(() => fonts.filter((font) => fontMatches(font, query)), [fonts, query]);
  const selected = fonts.find((font) => font.family === value);
  const sampleUsesHebrew = /[\u0590-\u05ff]/.test(sampleText || '');
  const selectedPreview = selected
    ? (sampleText && (!sampleUsesHebrew || selected.supports?.includes('he'))
      ? sampleText
      : (selected.supports?.includes('he') ? selected.sampleHe : selected.sampleEn) || selected.sample || 'SweetLight')
    : 'ברירת המחדל של הטמפלייט';

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 40);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const choose = (family) => {
    onChange(family);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="font-picker" ref={rootRef}>
      <button
        type="button"
        className={`font-picker-trigger${open ? ' is-open' : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="font-picker-current">
          <strong style={{ fontFamily: selected?.family || 'inherit' }}>
            {selectedPreview}
          </strong>
          <small>{selected?.labelHe || selected?.label || 'ללא בחירה מקומית'}</small>
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>

      {open && (
        <div className="font-picker-popover">
          <label className="font-picker-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש פונט"
              aria-label="חיפוש פונט"
            />
          </label>

          <div id={listboxId} className="font-picker-list" role="listbox" aria-label={ariaLabel}>
            {allowBlank && !query && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={`font-picker-option${!value ? ' is-selected' : ''}`}
                onClick={() => choose('')}
              >
                <span className="font-picker-option-copy">
                  <strong>ברירת המחדל</strong>
                  <small>משתמש בפונט של הטמפלייט הפעיל</small>
                </span>
                {!value && <Check size={16} aria-hidden="true" />}
              </button>
            )}

            {filteredFonts.map((font) => {
              const active = font.family === value;
              const preview = sampleText && (!sampleUsesHebrew || font.supports?.includes('he'))
                ? sampleText
                : (font.supports?.includes('he') ? font.sampleHe : font.sampleEn) || font.sample || 'SweetLight';
              return (
                <button
                  key={font.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`font-picker-option${active ? ' is-selected' : ''}`}
                  onClick={() => choose(font.family)}
                >
                  <span className="font-picker-option-copy">
                    <strong style={{ fontFamily: font.family }}>{preview}</strong>
                    <span className="font-picker-option-meta">
                      <small>{font.labelHe || font.label}</small>
                      <FontSupportBadge font={font} />
                    </span>
                  </span>
                  {active && <Check size={16} aria-hidden="true" />}
                </button>
              );
            })}

            {filteredFonts.length === 0 && (
              <p className="font-picker-empty">לא נמצא פונט מתאים</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TypographyControls({
  headingValue,
  bodyValue,
  accentValue,
  nameValue,
  titleLabel = 'פונט כותרת',
  bodyLabel = 'פונט טקסט',
  accentLabel = 'פונט משני',
  nameLabel = 'פונט שם',
  onHeadingChange,
  onBodyChange,
  onAccentChange,
  onNameChange,
  showAccent = false,
  showName = false,
  headingSample,
  bodySample,
}) {
  return (
    <div className="typography-controls">
      <FieldLabel>{titleLabel}</FieldLabel>
      <FontFamilySelect value={headingValue} onChange={onHeadingChange} sampleText={headingSample} ariaLabel={titleLabel} />

      <FieldLabel>{bodyLabel}</FieldLabel>
      <FontFamilySelect value={bodyValue} onChange={onBodyChange} sampleText={bodySample} ariaLabel={bodyLabel} />

      {showAccent && (
        <>
          <FieldLabel>{accentLabel}</FieldLabel>
          <FontFamilySelect value={accentValue} onChange={onAccentChange} ariaLabel={accentLabel} />
        </>
      )}

      {showName && (
        <>
          <FieldLabel>{nameLabel}</FieldLabel>
          <FontFamilySelect value={nameValue} onChange={onNameChange} ariaLabel={nameLabel} />
        </>
      )}
    </div>
  );
}
