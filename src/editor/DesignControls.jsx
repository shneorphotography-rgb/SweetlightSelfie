import { Check } from 'lucide-react';
import { FieldLabel } from './TypographyControls';

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

export function ChoiceGrid({
  label,
  value,
  options,
  onChange,
  columns = 3,
  hint,
}) {
  return (
    <div className="design-control-group">
      {label && <FieldLabel>{label}</FieldLabel>}
      {hint && <p className="design-control-hint">{hint}</p>}
      <div
        className="design-choice-grid"
        style={{ '--design-choice-columns': columns }}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              className={`design-choice${active ? ' is-active' : ''}`}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.id)}
            >
              {option.preview && (
                <span className={`design-choice-preview ${option.preview}`} aria-hidden="true" />
              )}
              <span>{option.label}</span>
              {active && <Check size={14} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function RangeControl({ label, value, onChange, min, max, step = 1, suffix = '' }) {
  const safeValue = clamp(value, min, max);
  return (
    <label className="design-range-control">
      <span>
        <span>{label}</span>
        <output>{safeValue}{suffix}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function ColorControl({ label, value, onChange, allowEmpty = false }) {
  const normalized = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
  return (
    <label className="design-color-control">
      <span>{label}</span>
      <span className="design-color-control-row">
        <input
          type="color"
          value={normalized}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={`${label} – בחירת צבע`}
        />
        <input
          type="text"
          dir="ltr"
          value={value || ''}
          placeholder={allowEmpty ? 'ברירת מחדל' : '#000000'}
          onChange={(event) => {
            const next = event.target.value.trim();
            if (allowEmpty && !next) onChange('');
            if (/^#[0-9a-f]{0,6}$/i.test(next)) onChange(next.toUpperCase());
          }}
          onBlur={(event) => {
            const next = event.target.value;
            if (next && !/^#[0-9a-f]{6}$/i.test(next)) onChange(normalized.toUpperCase());
          }}
          aria-label={`${label} – ערך HEX`}
        />
      </span>
    </label>
  );
}

const EFFECT_PRESETS = [
  { id: 'none', label: 'נקי' },
  { id: 'soft', label: 'צל רך' },
  { id: 'defined', label: 'מודגש' },
  { id: 'embossed', label: 'מובלט' },
];

export const DEFAULT_TEXT_STYLE = {
  preset: 'none',
  color: '',
  shadowEnabled: false,
  shadowColor: '#1A1814',
  shadowOpacity: 22,
  shadowBlur: 12,
  shadowX: 0,
  shadowY: 4,
  outlineEnabled: false,
  outlineColor: '#FAFAF8',
  outlineWidth: 1,
};

export function normalizeTextStyle(value) {
  return { ...DEFAULT_TEXT_STYLE, ...(value || {}) };
}

export function getTextStylePreset(id, currentValue) {
  const current = normalizeTextStyle(currentValue);
  const presets = {
    none: {
      preset: 'none',
      shadowEnabled: false,
      outlineEnabled: false,
    },
    soft: {
      preset: 'soft',
      shadowEnabled: true,
      shadowOpacity: 20,
      shadowBlur: 16,
      shadowX: 0,
      shadowY: 5,
      outlineEnabled: false,
    },
    defined: {
      preset: 'defined',
      shadowEnabled: true,
      shadowOpacity: 28,
      shadowBlur: 7,
      shadowX: 0,
      shadowY: 3,
      outlineEnabled: true,
      outlineWidth: 0.6,
    },
    embossed: {
      preset: 'embossed',
      shadowEnabled: true,
      shadowOpacity: 32,
      shadowBlur: 3,
      shadowX: 1,
      shadowY: 2,
      outlineEnabled: true,
      outlineWidth: 0.5,
    },
  };
  return { ...current, ...(presets[id] || presets.none) };
}

export function TextEffectControls({ value, onChange, title = 'עיצוב הכותרת' }) {
  const style = normalizeTextStyle(value);
  const patch = (next) => onChange({ ...style, ...next, preset: next.preset || 'custom' });

  return (
    <div className="design-effect-controls">
      <FieldLabel>{title}</FieldLabel>
      <div className="design-effect-presets" role="radiogroup" aria-label="אפקט מוכן">
        {EFFECT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={style.preset === preset.id}
            className={style.preset === preset.id ? 'is-active' : ''}
            onClick={() => onChange(getTextStylePreset(preset.id, style))}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <ColorControl label="צבע הכותרת" value={style.color} allowEmpty onChange={(color) => patch({ color })} />

      <label className="design-toggle-row">
        <span>
          <strong>צל</strong>
          <small>הצללה עדינה שנשארת קריאה על כל רקע</small>
        </span>
        <input
          type="checkbox"
          checked={style.shadowEnabled}
          onChange={(event) => patch({ shadowEnabled: event.target.checked })}
        />
      </label>

      {style.shadowEnabled && (
        <div className="design-control-nested">
          <ColorControl label="גוון הצל" value={style.shadowColor} onChange={(shadowColor) => patch({ shadowColor })} />
          <RangeControl label="שקיפות" value={style.shadowOpacity} min={0} max={100} suffix="%" onChange={(shadowOpacity) => patch({ shadowOpacity })} />
          <RangeControl label="טשטוש" value={style.shadowBlur} min={0} max={32} suffix="px" onChange={(shadowBlur) => patch({ shadowBlur })} />
          <div className="design-control-split">
            <RangeControl label="אופקי" value={style.shadowX} min={-16} max={16} suffix="px" onChange={(shadowX) => patch({ shadowX })} />
            <RangeControl label="אנכי" value={style.shadowY} min={-16} max={16} suffix="px" onChange={(shadowY) => patch({ shadowY })} />
          </div>
        </div>
      )}

      <label className="design-toggle-row">
        <span>
          <strong>קו מתאר</strong>
          <small>מומלץ בעובי עדין כדי לשמור על מראה טבעי</small>
        </span>
        <input
          type="checkbox"
          checked={style.outlineEnabled}
          onChange={(event) => patch({ outlineEnabled: event.target.checked })}
        />
      </label>

      {style.outlineEnabled && (
        <div className="design-control-nested">
          <ColorControl label="צבע קו" value={style.outlineColor} onChange={(outlineColor) => patch({ outlineColor })} />
          <RangeControl label="עובי" value={style.outlineWidth} min={0.2} max={3} step={0.1} suffix="px" onChange={(outlineWidth) => patch({ outlineWidth })} />
        </div>
      )}
    </div>
  );
}
