import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { useEditor, useEditorPanelState } from '../EditorContext';
import ImageFrameEditor from '../ImageFrameEditor';
import ImageUpload from '../ImageUpload';
import PanelTabs from '../PanelTabs';
import TypographyControls, { FieldLabel, FontFamilySelect } from '../TypographyControls';
import {
  ChoiceGrid,
  TextEffectControls,
} from '../DesignControls';
import {
  ABOUT_CONTENT_POSITIONS,
  ABOUT_LAYOUT_OPTIONS,
  ABOUT_MASK_OPTIONS,
  ABOUT_STATS_LAYOUTS,
} from '../../theme/designOptions';
import { normalizeMultilineText } from '../../utils/textFormatting';
import '../about-design.css';

const inputStyle = {
  width: '100%',
  padding: '0.68rem 0.75rem',
  border: '1px solid var(--ssf-border)',
  borderRadius: '7px',
  fontFamily: 'Assistant, Heebo, sans-serif',
  fontSize: '0.88rem',
  color: 'var(--ssf-text)',
  background: 'var(--ssf-surface)',
  outline: 'none',
  boxSizing: 'border-box',
  minHeight: '44px',
};

function Input({ value, onChange, placeholder, multiline = false, rows = 5, ariaLabel }) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        aria-label={ariaLabel || placeholder}
        style={{ ...inputStyle, resize: 'vertical', minHeight: '9rem', lineHeight: 1.65 }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      style={inputStyle}
    />
  );
}

function PanelHeading({ title, description, compact = false }) {
  return (
    <header className={`about-panel-heading${compact ? ' is-compact' : ''}`}>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </header>
  );
}

function makeImageId(src, index = 0) {
  const clean = String(src || '').split('/').pop()?.replace(/[^a-z0-9]/gi, '-') || 'image';
  return `about-${clean}-${index}`;
}

function normalizeAboutImages(about) {
  if (Array.isArray(about.images) && about.images.length) {
    return about.images
      .map((image, index) => {
        if (typeof image === 'string') return { id: makeImageId(image, index), src: image, frame: {} };
        return image?.src ? { ...image, id: image.id || makeImageId(image.src, index), frame: image.frame || {} } : null;
      })
      .filter(Boolean);
  }

  if (!about.image) return [];
  return [{
    id: 'about-legacy-profile',
    src: about.image,
    frame: about.imageFrame || {},
    alt: '',
  }];
}

function moveItem(items, from, to) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function SmallIconButton({ label, onClick, disabled = false, danger = false, children }) {
  return (
    <button
      type="button"
      className={`about-icon-button${danger ? ' is-danger' : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function StatsEditor({ about, stats, patchAbout }) {
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const updateStat = (index, patch) => {
    patchAbout({ stats: stats.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) });
  };

  return (
    <div className="about-editor-section">
      <PanelHeading
        compact
        title="נתונים קצרים"
        description="המספרים נשארים כקבוצה מסודרת ורספונסיבית, עם בחירה בין שורה, רשת וכרטיסים."
      />

      <ChoiceGrid
        label="פריסת הנתונים"
        value={about.statsLayout || 'row'}
        options={ABOUT_STATS_LAYOUTS}
        onChange={(statsLayout) => patchAbout({ statsLayout })}
      />

      <div className="about-stats-editor-list">
        {stats.map((stat, index) => (
          <article className="about-stat-editor" key={stat.id || index}>
            <div className="about-stat-editor-head">
              <strong>נתון {index + 1}</strong>
              <div className="about-inline-actions">
                <SmallIconButton label="הזז נתון למעלה" disabled={index === 0} onClick={() => patchAbout({ stats: moveItem(stats, index, index - 1) })}>
                  <ArrowUp size={15} />
                </SmallIconButton>
                <SmallIconButton label="הזז נתון למטה" disabled={index === stats.length - 1} onClick={() => patchAbout({ stats: moveItem(stats, index, index + 1) })}>
                  <ArrowDown size={15} />
                </SmallIconButton>
                <SmallIconButton label="הסר נתון" danger onClick={() => setPendingRemoval(index)}>
                  <Trash2 size={15} />
                </SmallIconButton>
              </div>
            </div>

            <div className="about-stat-editor-fields">
              <Input
                value={stat.value || ''}
                onChange={(event) => updateStat(index, { value: event.target.value })}
                placeholder="500+"
                ariaLabel={`ערך נתון ${index + 1}`}
              />
              <Input
                value={stat.label || ''}
                onChange={(event) => updateStat(index, { label: event.target.value })}
                placeholder="זוגות מרוצים"
                ariaLabel={`תיאור נתון ${index + 1}`}
              />
            </div>

            {pendingRemoval === index && (
              <div className="about-delete-confirm" role="alert">
                <span>להסיר את הנתון? ניתן לבטל אחר כך דרך Undo.</span>
                <button type="button" onClick={() => setPendingRemoval(null)}>ביטול</button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => {
                    patchAbout({ stats: stats.filter((_, itemIndex) => itemIndex !== index) });
                    setPendingRemoval(null);
                  }}
                >
                  הסרה
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {stats.length < 6 && (
        <button
          type="button"
          className="about-add-button"
          onClick={() => patchAbout({ stats: [...stats, { id: `stat-${Date.now()}`, value: '', label: '' }] })}
        >
          <Plus size={16} />
          הוספת נתון
        </button>
      )}
    </div>
  );
}

function MediaEditor({ about, images, selectedId, setSelectedId, patchAbout }) {
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const selectedIndex = Math.max(0, images.findIndex((image) => image.id === selectedId));
  const selected = images[selectedIndex] || null;

  const commitImages = (nextImages, nextSelectedId) => {
    patchAbout({
      images: nextImages,
      image: nextImages[0]?.src || '',
      imageFrame: nextImages[0]?.frame || {},
    });
    if (nextSelectedId !== undefined) setSelectedId(nextSelectedId);
  };

  const updateSelected = (patch) => {
    if (!selected) return;
    const next = images.map((image) => (image.id === selected.id ? { ...image, ...patch } : image));
    patchAbout({ images: next });
  };

  return (
    <section>
      <PanelHeading
        title="תמונות ותחימה"
        description="הקובץ המלא מוצג כאן ללא חיתוך. מתחתיו ניתן לכוון בנפרד את החיתוך שיופיע באתר."
      />

      <ChoiceGrid
        label="פריסת התמונות"
        value={about.mediaLayout || 'single'}
        options={ABOUT_LAYOUT_OPTIONS}
        onChange={(mediaLayout) => patchAbout({ mediaLayout })}
        hint="תמונה יחידה משתמשת בראשונה; זוג ומערכתי משתמשים בשתי התמונות הראשונות."
      />

      <ChoiceGrid
        label="צורת התחימה"
        value={about.mediaMask || 'soft-square'}
        options={ABOUT_MASK_OPTIONS}
        columns={2}
        onChange={(mediaMask) => patchAbout({ mediaMask })}
      />

      {(about.mediaMask || 'soft-square') === 'organic' && (
        <label className="design-toggle-row about-motion-toggle">
          <span>
            <strong>תנועה אורגנית עדינה</strong>
            <small>המסכה נעה לאט בין שלוש צורות; התמונה והמיקוד נשארים יציבים.</small>
          </span>
          <input
            type="checkbox"
            checked={about.maskMotion !== false}
            onChange={(event) => patchAbout({ maskMotion: event.target.checked })}
          />
        </label>
      )}

      {images.length > 0 && (
        <div className="about-media-strip" role="list" aria-label="תמונות אודות">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              role="listitem"
              className={image.id === selected?.id ? 'is-selected' : ''}
              onClick={() => setSelectedId(image.id)}
              aria-label={`עריכת תמונה ${index + 1}`}
            >
              <img src={image.src} alt="" />
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      )}

      {images.length < 8 ? (
        <ImageUpload
          multiple
          onUpload={(paths, media) => {
            const stamp = Date.now();
            const uploaded = paths.slice(0, 8 - images.length).map((src, index) => {
              const metadata = media.find((item) => item.path === src) || {};
              return {
                id: `about-upload-${stamp}-${index}`,
                src,
                alt: '',
                frame: {},
                width: metadata.width || 0,
                height: metadata.height || 0,
                coverFocus: metadata.coverFocus || null,
              };
            });
            const next = [...images, ...uploaded];
            commitImages(next, uploaded[0]?.id || selected?.id);
          }}
          label={images.length ? 'הוספת תמונות' : 'העלאת תמונות אודות'}
        />
      ) : (
        <p className="about-media-limit">הגעתם למקסימום של 8 תמונות.</p>
      )}
      <p className="design-control-hint">ניתן להוסיף עד 8 תמונות. פרטי הגודל ומיקוד הפנים נשמרים יחד עם כל העלאה.</p>

      {selected ? (
        <div className="about-selected-media">
          <div className="about-selected-media-head">
            <div>
              <strong>תמונה {selectedIndex + 1}</strong>
              <small>{selected.width && selected.height ? `${selected.width} × ${selected.height}px` : 'תצוגת מקור מלאה'}</small>
            </div>
            <div className="about-inline-actions">
              <SmallIconButton label="הזז תמונה למעלה" disabled={selectedIndex === 0} onClick={() => commitImages(moveItem(images, selectedIndex, selectedIndex - 1))}>
                <ArrowUp size={15} />
              </SmallIconButton>
              <SmallIconButton label="הזז תמונה למטה" disabled={selectedIndex === images.length - 1} onClick={() => commitImages(moveItem(images, selectedIndex, selectedIndex + 1))}>
                <ArrowDown size={15} />
              </SmallIconButton>
              <SmallIconButton label="הסר תמונה" danger onClick={() => setPendingRemoval(selected.id)}>
                <Trash2 size={15} />
              </SmallIconButton>
            </div>
          </div>

          <div className="about-full-source-preview">
            <img src={selected.src} alt={selected.alt || 'תצוגה מלאה של תמונת אודות'} />
            <span><ImageIcon size={13} /> מקור מלא — ללא חיתוך</span>
          </div>

          <FieldLabel>תיאור נגיש לתמונה</FieldLabel>
          <Input
            value={selected.alt || ''}
            onChange={(event) => updateSelected({ alt: event.target.value })}
            placeholder="לדוגמה: עומר מצלם זוג בחופה"
          />

          <ImageFrameEditor
            src={selected.src}
            value={selected.frame}
            onChange={(frame) => updateSelected({ frame })}
            aspectRatio={(about.mediaMask || 'soft-square') === 'circle' ? '1 / 1' : '4 / 5'}
            label="מיקום התמונה בתוך התחימה"
            previewStyle={{
              borderRadius: (about.mediaMask || 'soft-square') === 'circle' ? '50%' : '14px',
            }}
          />

          {pendingRemoval === selected.id && (
            <div className="about-delete-confirm" role="alert">
              <span>להסיר את התמונה מהאזור?</span>
              <button type="button" onClick={() => setPendingRemoval(null)}>ביטול</button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  const next = images.filter((image) => image.id !== selected.id);
                  commitImages(next, next[Math.min(selectedIndex, next.length - 1)]?.id || null);
                  setPendingRemoval(null);
                }}
              >
                הסרה
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="about-empty-media">
          <ImageIcon size={24} />
          <span>העלו תמונה ראשונה כדי להתחיל לעצב את התחימה.</span>
        </div>
      )}
    </section>
  );
}

export default function AboutPanel() {
  const { config, replaceConfig, updateConfig } = useEditor();
  const [activeTab, setActiveTab] = useEditorPanelState('about', 'activeTab', 'content');
  const about = config.sections?.about || {};
  const stats = Array.isArray(about.stats) ? about.stats : [];
  const images = useMemo(() => normalizeAboutImages(about), [about.images, about.image, about.imageFrame]);
  const [selectedImageId, setSelectedImageId] = useEditorPanelState('about', 'selectedImageId', images[0]?.id || null);

  useEffect(() => {
    if (!images.some((image) => image.id === selectedImageId)) {
      setSelectedImageId(images[0]?.id || null);
    }
  }, [images, selectedImageId]);

  const patchAbout = (patch) => {
    const entries = Object.entries(patch);
    if (entries.length === 1) {
      const [[key, value]] = entries;
      updateConfig(`sections.about.${key}`, value);
      return;
    }
    replaceConfig((current) => ({
      ...current,
      sections: {
        ...current.sections,
        about: {
          ...(current.sections?.about || {}),
          ...patch,
        },
      },
    }));
  };

  const tabs = [
    { id: 'content', label: 'תוכן', badge: stats.length },
    { id: 'media', label: 'תמונות', badge: images.length },
  ];

  return (
    <div className="about-panel">
      <PanelTabs
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="אפשרויות עריכת אזור אודות"
      />

      <div role="tabpanel" tabIndex={0} className="about-panel-tab-content">
        {activeTab === 'content' && (
          <section>
            <PanelHeading
              title="תוכן האודות"
              description="הטקסט, הנתונים והטיפוגרפיה נמצאים יחד, כך שרואים את כל הסיפור במקום אחד."
            />

            <FieldLabel>כותרת</FieldLabel>
            <Input
              value={about.title || ''}
              onChange={(event) => patchAbout({ title: event.target.value })}
              placeholder="קצת עליי"
            />

            <FieldLabel>תיאור</FieldLabel>
            <Input
              multiline
              rows={7}
              value={normalizeMultilineText(about.description)}
              onChange={(event) => patchAbout({ description: event.target.value })}
              placeholder="ספרו על עצמכם..."
            />

            <ChoiceGrid
              label="מיקום התוכן"
              value={about.contentPosition || 'start'}
              options={ABOUT_CONTENT_POSITIONS}
              onChange={(contentPosition) => patchAbout({ contentPosition })}
              hint="שלוש נקודות פתיחה בטוחות לכל מסך. הפריסה נשארת רספונסיבית גם לאחר החלפת תמונות."
            />

            <div className="about-editor-section">
              <PanelHeading compact title="פונטים" description="כל אפשרות מציגה את הפונט עצמו ומסומנת לפי תמיכה בעברית ובאנגלית." />
              <TypographyControls
                headingValue={about.typography?.headingFamily}
                bodyValue={about.typography?.bodyFamily}
                headingSample={about.title || 'קצת עליי'}
                bodySample="הסיפור שלכם"
                onHeadingChange={(headingFamily) => patchAbout({ typography: { ...(about.typography || {}), headingFamily } })}
                onBodyChange={(bodyFamily) => patchAbout({ typography: { ...(about.typography || {}), bodyFamily } })}
              />

              <FieldLabel>פונט המספרים</FieldLabel>
              <FontFamilySelect
                value={about.typography?.accentFamily || ''}
                onChange={(accentFamily) => patchAbout({ typography: { ...(about.typography || {}), accentFamily } })}
                sampleText="500+"
                ariaLabel="פונט מספרי הנתונים"
              />

              <FieldLabel>פונט תיאור הנתונים</FieldLabel>
              <FontFamilySelect
                value={about.typography?.nameFamily || ''}
                onChange={(nameFamily) => patchAbout({ typography: { ...(about.typography || {}), nameFamily } })}
                sampleText="זוגות מרוצים"
                ariaLabel="פונט תיאור הנתונים"
              />
            </div>

            <div className="about-editor-section">
              <TextEffectControls
                value={about.textStyle}
                onChange={(textStyle) => patchAbout({ textStyle })}
                title="נראות הכותרת"
              />
            </div>

            <StatsEditor about={about} stats={stats} patchAbout={patchAbout} />
          </section>
        )}

        {activeTab === 'media' && (
          <MediaEditor
            about={about}
            images={images}
            selectedId={selectedImageId}
            setSelectedId={setSelectedImageId}
            patchAbout={patchAbout}
          />
        )}
      </div>
    </div>
  );
}
