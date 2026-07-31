import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEditor, useEditorPanelState } from '../EditorContext';
import PanelTabs from '../PanelTabs';
import TypographyControls from '../TypographyControls';
import { COLOR_PRESETS, TEXT_TEMPLATES } from '../../theme/designOptions';
import '../about-design.css';

const FONT_FAMILY = 'Heebo, sans-serif';
const BORDER_COLOR = 'var(--ssf-border)';
const MUTED_COLOR = 'var(--ssf-muted)';
const ACCENT_COLOR = 'var(--ssf-violet)';

const cardStyle = {
  minHeight: '92px',
  borderRadius: '12px',
  border: `1px solid ${BORDER_COLOR}`,
  background: 'var(--ssf-surface)',
  padding: '0.85rem 0.9rem',
  cursor: 'pointer',
  textAlign: 'right',
  transition: 'border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease',
};

const secondaryButtonStyle = {
  minHeight: '44px',
  padding: '0.6rem 0.9rem',
  border: `1px solid ${BORDER_COLOR}`,
  borderRadius: '10px',
  background: 'var(--ssf-surface)',
  color: 'var(--ssf-text)',
  fontFamily: FONT_FAMILY,
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const TEMPLATE_OVERRIDE_PATHS = [
  'sections.hero.titleFontFamily',
  'sections.hero.typography.headingFamily',
  'sections.hero.typography.bodyFamily',
  'sections.about.typography.headingFamily',
  'sections.about.typography.bodyFamily',
  'sections.about.typography.accentFamily',
  'sections.about.typography.nameFamily',
  'sections.gallery.typography.headingFamily',
  'sections.gallery.typography.bodyFamily',
  'sections.gallery.typography.accentFamily',
  'sections.pricing.typography.headingFamily',
  'sections.pricing.typography.bodyFamily',
  'sections.pricing.typography.accentFamily',
  'sections.faq.typography.headingFamily',
  'sections.faq.typography.bodyFamily',
  'sections.testimonials.typography.headingFamily',
  'sections.testimonials.typography.bodyFamily',
  'sections.testimonials.typography.nameFamily',
  'sections.contact.typography.headingFamily',
  'sections.contact.typography.bodyFamily',
];

const CUSTOM_COLOR_FIELDS = [
  { key: 'background', label: 'רקע האתר', description: 'המשטח הרחב שמאחורי כל האזורים' },
  { key: 'surface', label: 'משטח משני', description: 'אזורים, כרטיסים ורקעים שקטים', allowOpacity: true },
  { key: 'text', label: 'טקסט ראשי', description: 'כותרות וטקסטים מרכזיים' },
  { key: 'textMuted', label: 'טקסט משני', description: 'הסברים, תוויות וטקסט עדין' },
  { key: 'accent', label: 'צבע הדגשה', description: 'קווים, בחירות וקישורים' },
  { key: 'accentDark', label: 'הדגשה כהה', description: 'מצבי ריחוף ופעולות מודגשות' },
  { key: 'border', label: 'קווים ומסגרות', description: 'מפרידים ותחימות עדינות', allowOpacity: true },
  { key: 'buttonBackground', label: 'רקע כפתור', description: 'הפעולה הראשית באתר' },
  { key: 'buttonText', label: 'טקסט כפתור', description: 'הטקסט שמופיע על הפעולה הראשית' },
];

function normalizeHex(value, fallback = '#000000') {
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value || '')) return value.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(value || '')) {
    const [r, g, b] = value.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

function splitHex(value) {
  const normalized = normalizeHex(value);
  return {
    base: normalized.slice(0, 7),
    opacity: normalized.length === 9 ? Math.round((Number.parseInt(normalized.slice(7), 16) / 255) * 100) : 100,
  };
}

function withOpacity(value, opacity) {
  const base = splitHex(value).base;
  if (opacity >= 100) return base;
  const alpha = Math.round((Math.max(0, Math.min(100, opacity)) / 100) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `${base}${alpha}`;
}

function hexToRgb(value) {
  const { base } = splitHex(value);
  return [
    Number.parseInt(base.slice(1, 3), 16),
    Number.parseInt(base.slice(3, 5), 16),
    Number.parseInt(base.slice(5, 7), 16),
  ];
}

function relativeLuminance(value) {
  const channels = hexToRgb(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function deepSet(obj, path, value) {
  const keys = path.split('.');
  const next = Array.isArray(obj) ? [...obj] : { ...obj };
  let current = next;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...(current[key] || {}) };
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return next;
}

function applyPresetToConfig(config, preset) {
  let next = config;

  Object.entries(preset.colors).forEach(([key, value]) => {
    next = deepSet(next, `theme.colors.light.${key}`, value);
  });

  next = deepSet(next, 'theme.preset', preset.id);
  return next;
}

function applyTemplateToConfig(config, template) {
  let next = config;

  next = deepSet(next, 'theme.textTemplateId', template.id);
  next = deepSet(next, 'theme.headingFamily', template.headingFamily);
  next = deepSet(next, 'theme.bodyFamily', template.bodyFamily);
  next = deepSet(next, 'theme.heroTitleFamily', template.heroTitleFamily || template.headingFamily);

  TEMPLATE_OVERRIDE_PATHS.forEach((path) => {
    next = deepSet(next, path, '');
  });

  return next;
}

function PanelHeading({ title, description }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3
        style={{
          margin: 0,
          color: 'var(--ssf-text)',
          fontFamily: FONT_FAMILY,
          fontSize: '1rem',
          fontWeight: 600,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: '0.3rem 0 0',
            color: MUTED_COLOR,
            fontFamily: FONT_FAMILY,
            fontSize: '0.75rem',
            lineHeight: 1.65,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

function SelectionBadge() {
  return (
    <span
      style={{
        padding: '0.2rem 0.45rem',
        borderRadius: '999px',
        background: 'var(--ssf-violet)',
        color: '#fff',
        fontFamily: FONT_FAMILY,
        fontSize: '0.61rem',
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      נבחרה
    </span>
  );
}

function PresetCard({ preset, active, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${preset.nameHe}${active ? ', ערכת הצבע הפעילה' : ''}`}
      onClick={onClick}
      style={{
        ...cardStyle,
        borderColor: active ? ACCENT_COLOR : BORDER_COLOR,
        background: active ? 'var(--ssf-brand-soft)' : 'var(--ssf-surface)',
        boxShadow: active ? '0 0 0 1px color-mix(in srgb, var(--ssf-violet) 18%, transparent)' : 'none',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <span style={{ fontFamily: FONT_FAMILY, fontSize: '0.82rem', color: 'var(--ssf-text)', fontWeight: active ? 600 : 500 }}>
          {preset.nameHe}
        </span>
        {active && <SelectionBadge />}
      </span>

      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${preset.swatch.length}, minmax(0, 1fr))`,
          height: '28px',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '8px',
        }}
      >
        {preset.swatch.map((color, index) => (
          <span key={`${color}-${index}`} style={{ background: color }} />
        ))}
      </span>
    </button>
  );
}

function TemplateCard({ template, active, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${template.nameHe}${active ? ', טמפלייט הטקסט הפעיל' : ''}`}
      onClick={onClick}
      style={{
        ...cardStyle,
        minHeight: '154px',
        borderColor: active ? ACCENT_COLOR : BORDER_COLOR,
        background: active ? 'var(--ssf-brand-soft)' : 'var(--ssf-surface)',
        boxShadow: active ? '0 0 0 1px color-mix(in srgb, var(--ssf-violet) 18%, transparent)' : 'none',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.7rem',
        }}
      >
        <span style={{ fontFamily: FONT_FAMILY, fontSize: '0.75rem', color: MUTED_COLOR, fontWeight: 500 }}>
          {template.nameHe}
        </span>
        {active && <SelectionBadge />}
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: '0.34rem' }}>
        <span style={{ fontFamily: template.heroTitleFamily || template.headingFamily, fontSize: '1.24rem', color: 'var(--ssf-text)', lineHeight: 1.15 }}>
          כותרת ראשית
        </span>
        <span style={{ fontFamily: template.headingFamily, fontSize: '1rem', color: 'var(--ssf-text)', lineHeight: 1.25 }}>
          הסיפור שלכם
        </span>
        <span style={{ fontFamily: template.bodyFamily, fontSize: '0.78rem', color: 'var(--ssf-muted)', lineHeight: 1.55 }}>
          טקסט לדוגמה שממחיש את האופי של הטמפלייט.
        </span>
      </span>
    </button>
  );
}

function SemanticColorField({ field, value, onChange }) {
  const normalized = normalizeHex(value);
  const { base, opacity } = splitHex(normalized);
  const [draft, setDraft] = useState(normalized);

  useEffect(() => setDraft(normalized), [normalized]);

  const commitDraft = () => {
    if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/i.test(draft)) {
      onChange(normalizeHex(draft));
    } else {
      setDraft(normalized);
    }
  };

  return (
    <div className="palette-color-field">
      <div className="palette-color-copy">
        <strong>{field.label}</strong>
        <small>{field.description}</small>
      </div>
      <div className="palette-color-value">
        <input
          type="color"
          value={base}
          onChange={(event) => onChange(withOpacity(event.target.value.toUpperCase(), opacity))}
          aria-label={`${field.label} – בחירת צבע`}
        />
        <input
          type="text"
          dir="ltr"
          value={draft}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
              event.currentTarget.blur();
            }
          }}
          aria-label={`${field.label} – ערך HEX`}
        />
      </div>
      {field.allowOpacity && (
        <label className="palette-opacity-control">
          <span>שקיפות</span>
          <input
            type="range"
            min="10"
            max="100"
            step="1"
            value={opacity}
            onChange={(event) => onChange(withOpacity(base, Number(event.target.value)))}
          />
          <output>{opacity}%</output>
        </label>
      )}
    </div>
  );
}

function ContrastHint({ label, foreground, background }) {
  const ratio = contrastRatio(foreground, background);
  const passes = ratio >= 4.5;
  return (
    <div className={`palette-contrast-hint${passes ? ' is-good' : ' is-warning'}`}>
      {passes ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
      <span>
        <strong>{label}</strong>
        <small>{passes ? 'ניגודיות טובה' : 'כדאי להגדיל את הניגודיות'} · {ratio.toFixed(1)}:1</small>
      </span>
    </div>
  );
}

function CustomPaletteEditor({ colors, onChange }) {
  return (
    <section className="custom-palette-editor">
      <PanelHeading
        title="התאמה אישית"
        description="כל צבע מחובר לתפקיד ברור באתר. שינוי כאן מעדכן מיד את התצוגה בלי לפרק את השפה העיצובית."
      />

      <div className="palette-live-strip" aria-label="תצוגת ערכת הצבע האישית">
        {['background', 'surface', 'text', 'accent', 'border'].map((key) => (
          <span key={key} style={{ background: colors[key] }} />
        ))}
      </div>

      <div className="palette-contrast-grid">
        <ContrastHint label="טקסט על הרקע" foreground={colors.text} background={colors.background} />
        <ContrastHint label="כפתור ראשי" foreground={colors.buttonText} background={colors.buttonBackground} />
      </div>

      <div className="palette-color-list">
        {CUSTOM_COLOR_FIELDS.map((field) => (
          <SemanticColorField
            key={field.key}
            field={field}
            value={colors[field.key]}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>

      <p className="palette-accessibility-note">
        יחס של 4.5:1 ומעלה מומלץ לטקסט רגיל. השקיפות זמינה במשטחים ובקווים, שבהם היא בטוחה יותר לקריאות.
      </p>
    </section>
  );
}

export default function StylePanel() {
  const { config, replaceConfig, updateConfig, resetToDefault } = useEditor();
  const [activeTab, setActiveTab] = useEditorPanelState('style', 'activeTab', 'colors');
  const [confirmReset, setConfirmReset] = useState(false);

  const activePreset = useMemo(() => (
    config.theme?.preset || COLOR_PRESETS[0].id
  ), [config.theme?.preset]);

  const activeTemplate = useMemo(() => (
    config.theme?.textTemplateId || TEXT_TEMPLATES[0].id
  ), [config.theme?.textTemplateId]);

  const activeColors = useMemo(() => ({
    ...COLOR_PRESETS[0].colors,
    ...(config.theme?.colors?.light || {}),
  }), [config.theme?.colors?.light]);

  const updateCustomColor = (key, value) => {
    replaceConfig((current) => {
      let next = deepSet(current, `theme.colors.light.${key}`, value);
      next = deepSet(next, 'theme.preset', 'custom');
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PanelTabs
        tabs={[
          { id: 'colors', label: 'ערכות צבע', badge: COLOR_PRESETS.length },
          { id: 'texts', label: 'טקסטים', badge: TEXT_TEMPLATES.length },
          { id: 'fonts', label: 'פונטים' },
          { id: 'advanced', label: 'מתקדם' },
        ]}
        value={activeTab}
        onChange={(value) => {
          setActiveTab(value);
          setConfirmReset(false);
        }}
        ariaLabel="אפשרויות עיצוב כלליות"
      />

      <div
        role="tabpanel"
        aria-label={
          activeTab === 'colors'
            ? 'ערכות צבע'
            : activeTab === 'texts'
              ? 'טמפלייטי טקסט'
              : activeTab === 'fonts'
                ? 'פונטים גלובליים'
                : 'הגדרות מתקדמות'
        }
      >
        {activeTab === 'colors' && (
          <div>
            <PanelHeading
              title="ערכות צבע"
              description={`${COLOR_PRESETS.length} שילובי צבעים מוכנים. הבחירה משנה מיד את כל האתר, כולל טפסים וכפתורים.`}
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))',
                gap: '0.65rem',
              }}
            >
              {COLOR_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  active={activePreset === preset.id}
                  onClick={() => replaceConfig((current) => applyPresetToConfig(current, preset))}
                />
              ))}
            </div>

            <CustomPaletteEditor colors={activeColors} onChange={updateCustomColor} />
          </div>
        )}

        {activeTab === 'texts' && (
          <div>
            <PanelHeading
              title="טמפלייטי טקסט"
              description="כל טמפלייט מחיל משפחת פונטים אחידה על האתר ומנקה בחירות פונט מקומיות, כדי שהתוצאה תהיה מלאה ועקבית."
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {TEXT_TEMPLATES.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  active={activeTemplate === template.id}
                  onClick={() => replaceConfig((current) => applyTemplateToConfig(current, template))}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'fonts' && (
          <div>
            <PanelHeading
              title="פונטים גלובליים"
              description="ברירות המחדל לכותרות ולטקסטים בכל האתר. בחירות מקומיות באזור מסוים ממשיכות לקבל עדיפות."
            />

            <TypographyControls
              headingValue={config.theme?.headingFamily}
              bodyValue={config.theme?.bodyFamily}
              accentValue={config.theme?.heroTitleFamily}
              titleLabel="פונט כותרות באתר"
              bodyLabel="פונט טקסט באתר"
              accentLabel="פונט כותרת ראשית"
              onHeadingChange={(value) => updateConfig('theme.headingFamily', value)}
              onBodyChange={(value) => updateConfig('theme.bodyFamily', value)}
              onAccentChange={(value) => updateConfig('theme.heroTitleFamily', value)}
              headingSample="הסיפור שלכם"
              bodySample="רגעים אמיתיים שנשארים"
              showAccent
            />
          </div>
        )}

        {activeTab === 'advanced' && (
          <div>
            <PanelHeading
              title="איפוס העיצוב והתוכן"
              description="האיפוס מחזיר את האתר כולו לברירת המחדל, ולא רק את אפשרויות העיצוב במסך הזה."
            />

            <div
              style={{
                padding: '0.9rem',
                border: '1px solid color-mix(in srgb, var(--ssf-danger) 35%, var(--ssf-border))',
                borderRadius: '12px',
                background: 'color-mix(in srgb, var(--ssf-danger) 8%, var(--ssf-surface))',
              }}
            >
              <p
                style={{
                  margin: '0 0 0.8rem',
                  color: 'var(--ssf-danger)',
                  fontFamily: FONT_FAMILY,
                  fontSize: '0.76rem',
                  lineHeight: 1.65,
                }}
              >
                פעולה זו תמחק את כל השינויים המקומיים שנשמרו בעורך ותחזיר צבעים, טקסטים, תמונות והגדרות לברירת המחדל.
              </p>

              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  style={{
                    ...secondaryButtonStyle,
                    width: '100%',
                    borderColor: 'color-mix(in srgb, var(--ssf-danger) 35%, var(--ssf-border))',
                    background: 'var(--ssf-surface)',
                    color: 'var(--ssf-danger)',
                  }}
                >
                  איפוס כל השינויים
                </button>
              ) : (
                <div role="alert">
                  <p
                    style={{
                      margin: '0 0 0.65rem',
                      color: 'var(--ssf-danger)',
                      fontFamily: FONT_FAMILY,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    להחזיר את כל האתר לברירת המחדל?
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      style={{ ...secondaryButtonStyle, flex: 1 }}
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetToDefault();
                        setConfirmReset(false);
                      }}
                      style={{
                        ...secondaryButtonStyle,
                        flex: 1,
                        borderColor: 'var(--ssf-danger)',
                        background: 'var(--ssf-danger)',
                        color: '#fff',
                      }}
                    >
                      כן, לאפס הכול
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
