import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react';
import ImageUpload from '../ImageUpload';
import TypographyControls from '../TypographyControls';
import { useEditor } from '../EditorContext';
import {
  isCustomSectionId,
  normalizeCustomPosition,
  updateCustomSection,
} from '../../utils/siteSections';

const LAYOUTS = [
  { id: 'split', label: 'טקסט ותמונה', description: 'שני אזורים מאוזנים' },
  { id: 'editorial', label: 'מערכתי', description: 'תמונה גדולה וטקסט צף' },
  { id: 'stack', label: 'מלא', description: 'כותרת מעל גלריה' },
  { id: 'free', label: 'חופשי', description: 'הזזה עדינה בתוך גבולות בטוחים' },
];

function Field({ label, hint, children }) {
  return (
    <label className="custom-editor-field">
      <span>{label}</span>
      {hint && <small>{hint}</small>}
      {children}
    </label>
  );
}

function PositionSlider({ label, value, onChange }) {
  return (
    <label className="custom-position-slider">
      <span>{label}</span>
      <input
        type="range"
        min="-24"
        max="24"
        step="1"
        value={Number(value) || 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{Number(value) || 0}%</output>
    </label>
  );
}

function PositionControls({ title, value, onChange }) {
  const position = normalizeCustomPosition(value);
  const update = (key, nextValue) => onChange({ ...position, [key]: nextValue });

  return (
    <div className="custom-position-group">
      <h5>{title}</h5>
      <PositionSlider label="טקסט ימינה / שמאלה" value={position.contentX} onChange={(next) => update('contentX', next)} />
      <PositionSlider label="טקסט למעלה / למטה" value={position.contentY} onChange={(next) => update('contentY', next)} />
      <PositionSlider label="תמונות ימינה / שמאלה" value={position.mediaX} onChange={(next) => update('mediaX', next)} />
      <PositionSlider label="תמונות למעלה / למטה" value={position.mediaY} onChange={(next) => update('mediaY', next)} />
    </div>
  );
}

export default function CustomSectionPanel({ sectionId }) {
  const { config, updateConfig, replaceConfig } = useEditor();
  const data = config?.sections?.[sectionId];

  if (!isCustomSectionId(sectionId) || !data?.created) {
    return <p className="custom-editor-empty">האזור האישי כבר לא קיים.</p>;
  }

  const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  const update = (path, value) => updateConfig(`sections.${sectionId}.${path}`, value);
  const patch = (values) => replaceConfig(current => updateCustomSection(current, sectionId, values));

  const moveImage = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    update('images', next);
  };

  return (
    <div className="custom-section-editor">
      <section className="custom-editor-group">
        <header>
          <span>תוכן</span>
          <h3>מה יופיע באזור?</h3>
        </header>

        <Field label="שם בניווט" hint="זהו השם שיופיע בתפריט ובמסך מבנה האתר.">
          <input
            type="text"
            value={data.navLabel || ''}
            maxLength={34}
            onChange={(event) => update('navLabel', event.target.value)}
          />
        </Field>

        <Field label="כותרת קטנה">
          <input
            type="text"
            value={data.eyebrow || ''}
            onChange={(event) => update('eyebrow', event.target.value)}
          />
        </Field>

        <Field label="כותרת ראשית">
          <input
            type="text"
            value={data.title || ''}
            onChange={(event) => update('title', event.target.value)}
          />
        </Field>

        <Field label="טקסט">
          <textarea
            rows="7"
            value={data.text || ''}
            onChange={(event) => update('text', event.target.value)}
            placeholder="כתבו כאן את הטקסט שתרצו להציג…"
          />
        </Field>
      </section>

      <section className="custom-editor-group">
        <header>
          <span>פריסה</span>
          <h3>בחרו נקודת פתיחה</h3>
        </header>
        <div className="custom-layout-options" role="radiogroup" aria-label="פריסת האזור האישי">
          {LAYOUTS.map(layout => (
            <button
              key={layout.id}
              type="button"
              role="radio"
              aria-checked={(data.layout || 'split') === layout.id}
              className={(data.layout || 'split') === layout.id ? 'is-active' : ''}
              onClick={() => patch({
                layout: layout.id,
                desktopPosition: normalizeCustomPosition(),
                mobilePosition: normalizeCustomPosition(),
              })}
            >
              <span className={`custom-layout-sketch custom-layout-sketch--${layout.id}`} aria-hidden="true">
                <i />
                <i />
              </span>
              <strong>{layout.label}</strong>
              <small>{layout.description}</small>
            </button>
          ))}
        </div>

        <div className="custom-editor-two-fields">
          <Field label="יישור הטקסט">
            <select value={data.textAlign || 'right'} onChange={(event) => update('textAlign', event.target.value)}>
              <option value="right">ימין</option>
              <option value="center">מרכז</option>
              <option value="left">שמאל</option>
            </select>
          </Field>

          {(data.layout || 'split') === 'split' && (
            <Field label="צד התמונות">
              <select value={data.imageSide || 'start'} onChange={(event) => update('imageSide', event.target.value)}>
                <option value="start">ימין</option>
                <option value="end">שמאל</option>
              </select>
            </Field>
          )}
        </div>

        <Field label="גוון הרקע">
          <select value={data.backgroundColor || 'background'} onChange={(event) => update('backgroundColor', event.target.value)}>
            <option value="background">רקע האתר</option>
            <option value="surface">משטח משני</option>
          </select>
        </Field>

        {data.layout === 'free' && (
          <details className="custom-position-details" open>
            <summary>מיקום חופשי ובטוח</summary>
            <p>הטווח מוגבל בעדינות כדי שהתוכן לא ייצא מהמסך. המיקום נשמר בנפרד לדסקטופ ולמובייל.</p>
            <PositionControls
              title="דסקטופ"
              value={data.desktopPosition}
              onChange={(value) => update('desktopPosition', value)}
            />
            <PositionControls
              title="מובייל"
              value={data.mobilePosition}
              onChange={(value) => update('mobilePosition', value)}
            />
          </details>
        )}
      </section>

      <section className="custom-editor-group">
        <header>
          <span>תמונות</span>
          <h3>גלריה קטנה לאזור</h3>
        </header>

        <ImageUpload
          multiple
          label="הוספת תמונות"
          onUpload={(paths) => update('images', [...images, ...paths])}
        />

        {images.length > 0 ? (
          <ul className="custom-image-list" aria-label="תמונות האזור האישי">
            {images.map((source, index) => (
              <li key={`${source}-${index}`}>
                <img src={source} alt={`תמונה ${index + 1}`} />
                <span>{index + 1}</span>
                <div>
                  <button
                    type="button"
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0}
                    aria-label={`העברת תמונה ${index + 1} למעלה`}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, 1)}
                    disabled={index === images.length - 1}
                    aria-label={`העברת תמונה ${index + 1} למטה`}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => update('images', images.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`מחיקת תמונה ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="custom-image-empty">
            <ImagePlus size={22} aria-hidden="true" />
            <span>עדיין לא נוספו תמונות. הפריסה תציג בינתיים את הטקסט בלבד.</span>
          </div>
        )}
      </section>

      <section className="custom-editor-group">
        <header>
          <span>פונטים</span>
          <h3>התאמה לאזור הזה בלבד</h3>
        </header>
        <TypographyControls
          headingValue={data.typography?.headingFamily || ''}
          bodyValue={data.typography?.bodyFamily || ''}
          onHeadingChange={(value) => update('typography.headingFamily', value)}
          onBodyChange={(value) => update('typography.bodyFamily', value)}
          headingSample={data.title || 'כותרת אישית'}
          bodySample={(data.text || '').slice(0, 34) || 'טקסט לדוגמה באזור האישי'}
        />
      </section>
    </div>
  );
}
