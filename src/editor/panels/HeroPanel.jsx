import { useEffect, useMemo, useState } from 'react';
import {
  getHeroFrame,
  getRecommendedHeroFrame,
  hasRecommendedHeroFrame,
  HERO_PREVIEW_END_EVENT,
  HERO_PREVIEW_EVENT,
  normalizeHeroImage,
} from '../../utils/imageFrame';
import { useEditor, useEditorPanelState } from '../EditorContext';
import ImageFrameEditor from '../ImageFrameEditor';
import ImageUpload from '../ImageUpload';
import PanelTabs from '../PanelTabs';
import { FieldLabel, FontFamilySelect } from '../TypographyControls';
import '../hero-media.css';

const inputStyle = {
  width: '100%',
  minHeight: '44px',
  boxSizing: 'border-box',
  padding: '0.65rem 0.75rem',
  border: '1.5px solid var(--ssf-border)',
  borderRadius: '4px',
  outline: 'none',
  background: 'var(--ssf-surface)',
  color: 'var(--ssf-text)',
  fontFamily: 'Heebo, sans-serif',
  fontSize: '0.9rem',
};

const POSITION_PRESETS = [
  { id: 'top-right', label: 'ימין עליון', x: 76, y: 24 },
  { id: 'top-center', label: 'מרכז עליון', x: 50, y: 24 },
  { id: 'top-left', label: 'שמאל עליון', x: 24, y: 24 },
  { id: 'center-right', label: 'ימין', x: 76, y: 50 },
  { id: 'center', label: 'מרכז', x: 50, y: 50 },
  { id: 'center-left', label: 'שמאל', x: 24, y: 50 },
  { id: 'bottom-right', label: 'ימין תחתון', x: 76, y: 76 },
  { id: 'bottom-center', label: 'מרכז תחתון', x: 50, y: 76 },
  { id: 'bottom-left', label: 'שמאל תחתון', x: 24, y: 76 },
];

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function Input({ value, onChange, placeholder, dir = 'auto' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      dir={dir}
      style={inputStyle}
      onFocus={(event) => { event.target.style.borderColor = 'var(--ssf-violet)'; }}
      onBlur={(event) => { event.target.style.borderColor = 'var(--ssf-border)'; }}
    />
  );
}

function PanelHeading({ title, description }) {
  return (
    <header className="ssf-hero-panel-heading">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </header>
  );
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="ssf-hero-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function RangeControl({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <label className="ssf-hero-range">
      <span>{label}<output>{value}{suffix}</output></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ColorControl({ label, value, onChange }) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
  return (
    <label className="ssf-hero-color">
      <span>{label}</span>
      <input type="color" value={safeColor} onChange={(event) => onChange(event.target.value)} />
      <input
        type="text"
        value={value}
        dir="ltr"
        maxLength={7}
        onChange={(event) => /^#[0-9a-f]{0,6}$/i.test(event.target.value) && onChange(event.target.value)}
        aria-label={`${label} בקוד HEX`}
      />
    </label>
  );
}

function PlacementControls({ label, value, onChange }) {
  const position = { x: value?.x ?? 50, y: value?.y ?? 50 };
  return (
    <div className="ssf-placement-controls">
      <p>{label}</p>
      <div className="ssf-position-presets" role="group" aria-label={`מיקומים מומלצים עבור ${label}`}>
        {POSITION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            aria-label={preset.label}
            className={Math.abs(position.x - preset.x) < 2 && Math.abs(position.y - preset.y) < 2 ? 'is-active' : ''}
            onClick={() => onChange({ x: preset.x, y: preset.y })}
          >
            <span style={{ left: `${(preset.x - 24) / 52 * 100}%`, top: `${(preset.y - 24) / 52 * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="ssf-frame-controls__pair">
        <RangeControl label="אופקי" value={Math.round(position.x)} min={4} max={96} suffix="%" onChange={(x) => onChange({ ...position, x })} />
        <RangeControl label="אנכי" value={Math.round(position.y)} min={4} max={96} suffix="%" onChange={(y) => onChange({ ...position, y })} />
      </div>
    </div>
  );
}

function dispatchHeroPreview(src) {
  if (!src || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HERO_PREVIEW_EVENT, { detail: { src } }));
}

function endHeroPreview() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HERO_PREVIEW_END_EVENT));
}

export default function HeroPanel() {
  const { config, updateConfig } = useEditor();
  const [activeTab, setActiveTab] = useEditorPanelState('hero', 'activeTab', 'content');
  const [placementDevice, setPlacementDevice] = useEditorPanelState('hero', 'placementDevice', 'desktop');
  const [placementTarget, setPlacementTarget] = useEditorPanelState('hero', 'placementTarget', 'content');
  const [selectedIndex, setSelectedIndex] = useEditorPanelState('hero', 'selectedIndex', 0);
  const [frameDevice, setFrameDevice] = useEditorPanelState('hero', 'frameDevice', 'desktop');
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const photographer = config.photographer || {};
  const hero = config.sections?.hero || {};
  const images = useMemo(
    () => (hero.images || []).map((item) => normalizeHeroImage(item, hero.imagePositions)),
    [hero.imagePositions, hero.images],
  );
  const title = hasOwn(hero, 'title')
    ? hero.title
    : (hero.displayLanguage === 'he' ? hero.titleHe : hero.titleEn)
      || photographer.signatureName
      || photographer.name
      || '';
  const selectedImage = images[selectedIndex] || null;
  const tabs = [
    { id: 'content', label: 'תוכן ועיצוב' },
    { id: 'covers', label: 'תמונות קאבר', badge: images.length },
  ];

  useEffect(() => {
    if (!images.length) {
      setSelectedIndex(0);
      return;
    }
    if (selectedIndex >= images.length) setSelectedIndex(images.length - 1);
  }, [images.length, selectedIndex]);

  useEffect(() => {
    if (activeTab === 'covers' && selectedImage?.src) {
      dispatchHeroPreview(selectedImage.src);
      return () => endHeroPreview();
    }
    endHeroPreview();
    return undefined;
  }, [activeTab, selectedImage?.src]);

  useEffect(() => () => endHeroPreview(), []);

  const updateImages = (nextImages) => updateConfig('sections.hero.images', nextImages);

  const updateSelectedImage = (updater) => {
    if (!selectedImage) return;
    const nextImages = images.map((image, index) => (
      index === selectedIndex
        ? (typeof updater === 'function' ? updater(image) : { ...image, ...updater })
        : image
    ));
    updateImages(nextImages);
    dispatchHeroPreview(selectedImage.src);
  };

  const moveImage = (from, to) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateImages(next);
    setSelectedIndex((current) => {
      if (current === from) return to;
      if (from < current && to >= current) return current - 1;
      if (from > current && to <= current) return current + 1;
      return current;
    });
  };

  const deleteImage = (index) => {
    const next = images.filter((_, imageIndex) => imageIndex !== index);
    updateImages(next);
    setDeleteIndex(null);
    setSelectedIndex((current) => Math.max(0, current > index ? current - 1 : Math.min(current, next.length - 1)));
  };

  const currentPlacementPath = placementTarget === 'logo' ? 'logoPlacement' : 'contentPlacement';
  const currentPlacementDefault = placementTarget === 'logo'
    ? { x: 50, y: placementDevice === 'mobile' ? 31 : 32 }
    : { x: 50, y: placementDevice === 'mobile' ? 62 : 61 };
  const currentPlacement = hero[currentPlacementPath]?.[placementDevice] || currentPlacementDefault;
  const textEffects = hero.textEffects || {};
  const shadow = textEffects.shadow || {};
  const outline = textEffects.outline || {};
  const logoStyle = hero.logoStyle || {};

  return (
    <div className="ssf-hero-panel">
      <PanelTabs
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="אפשרויות עריכת אזור הבית"
      />

      <div role="tabpanel" tabIndex={0} className="ssf-hero-panel__body">
        {activeTab === 'content' && (
          <section>
            <PanelHeading
              title="התוכן הראשי"
              description="כותבים בשפה הרצויה — כיוון הטקסט מזוהה אוטומטית. הפונט, המיקום והאפקטים חיים כאן יחד."
            />

            <FieldLabel>שם או כותרת ראשית</FieldLabel>
            <Input
              value={title}
              onChange={(event) => updateConfig('sections.hero.title', event.target.value)}
              placeholder="עומר שניאור / Omer Shneor"
            />

            <FieldLabel>כותרת משנה</FieldLabel>
            <Input
              value={photographer.tagline || ''}
              onChange={(event) => updateConfig('photographer.tagline', event.target.value)}
              placeholder="מספר סיפורים דרך העדשה"
            />

            <div className="ssf-hero-inline-toggles">
              <Toggle checked={hero.showTitle !== false} onChange={(value) => updateConfig('sections.hero.showTitle', value)}>הצגת הכותרת</Toggle>
              <Toggle checked={hero.showTagline !== false} onChange={(value) => updateConfig('sections.hero.showTagline', value)}>הצגת כותרת המשנה</Toggle>
            </div>

            <FieldLabel>פונט הכותרת</FieldLabel>
            <FontFamilySelect
              value={hero.titleFontFamily || ''}
              sampleText={title || 'אבג Aa'}
              onChange={(value) => updateConfig('sections.hero.titleFontFamily', value)}
              ariaLabel="פונט הכותרת הראשית"
            />

            <FieldLabel>פונט כותרת המשנה</FieldLabel>
            <FontFamilySelect
              value={hero.typography?.bodyFamily || ''}
              sampleText={photographer.tagline || 'אבג Aa'}
              onChange={(value) => updateConfig('sections.hero.typography.bodyFamily', value)}
              ariaLabel="פונט כותרת המשנה"
            />

            <details className="ssf-hero-details" open>
              <summary>מיקום התוכן והלוגו</summary>
              <div className="ssf-hero-device-switch" role="group" aria-label="התאמה למסך">
                {['desktop', 'mobile'].map((device) => (
                  <button key={device} type="button" className={placementDevice === device ? 'is-active' : ''} onClick={() => setPlacementDevice(device)}>
                    {device === 'desktop' ? 'דסקטופ' : 'מובייל'}
                  </button>
                ))}
              </div>
              <div className="ssf-hero-target-switch" role="group" aria-label="בחירת רכיב למיקום">
                <button type="button" className={placementTarget === 'content' ? 'is-active' : ''} onClick={() => setPlacementTarget('content')}>טקסטים</button>
                <button type="button" className={placementTarget === 'logo' ? 'is-active' : ''} onClick={() => setPlacementTarget('logo')}>לוגו</button>
              </div>
              <PlacementControls
                label={placementTarget === 'logo' ? 'מיקום הלוגו' : 'מיקום התוכן'}
                value={currentPlacement}
                onChange={(value) => updateConfig(`sections.hero.${currentPlacementPath}.${placementDevice}`, value)}
              />
            </details>

            <details className="ssf-hero-details">
              <summary>צל, קו מתאר וצבע הטקסט</summary>
              <ColorControl label="צבע הטקסט" value={textEffects.color || '#ffffff'} onChange={(value) => updateConfig('sections.hero.textEffects.color', value)} />
              <Toggle checked={shadow.enabled !== false} onChange={(value) => updateConfig('sections.hero.textEffects.shadow.enabled', value)}>צל לטקסט</Toggle>
              {shadow.enabled !== false && (
                <div className="ssf-hero-control-stack">
                  <ColorControl label="צבע הצל" value={shadow.color || '#000000'} onChange={(value) => updateConfig('sections.hero.textEffects.shadow.color', value)} />
                  <RangeControl label="שקיפות" value={shadow.opacity ?? 0.34} min={0} max={1} step={0.01} onChange={(value) => updateConfig('sections.hero.textEffects.shadow.opacity', value)} />
                  <RangeControl label="טשטוש" value={shadow.blur ?? 24} min={0} max={64} suffix="px" onChange={(value) => updateConfig('sections.hero.textEffects.shadow.blur', value)} />
                  <div className="ssf-frame-controls__pair">
                    <RangeControl label="צל אופקי" value={shadow.x ?? 0} min={-30} max={30} suffix="px" onChange={(value) => updateConfig('sections.hero.textEffects.shadow.x', value)} />
                    <RangeControl label="צל אנכי" value={shadow.y ?? 8} min={-30} max={30} suffix="px" onChange={(value) => updateConfig('sections.hero.textEffects.shadow.y', value)} />
                  </div>
                </div>
              )}
              <Toggle checked={outline.enabled === true} onChange={(value) => updateConfig('sections.hero.textEffects.outline.enabled', value)}>קו מתאר</Toggle>
              {outline.enabled && (
                <div className="ssf-hero-control-stack">
                  <ColorControl label="צבע קו המתאר" value={outline.color || '#000000'} onChange={(value) => updateConfig('sections.hero.textEffects.outline.color', value)} />
                  <RangeControl label="עובי" value={outline.width ?? 1} min={0} max={4} step={0.25} suffix="px" onChange={(value) => updateConfig('sections.hero.textEffects.outline.width', value)} />
                </div>
              )}
            </details>

            <details className="ssf-hero-details">
              <summary>לוגו ומסגרת</summary>
              {photographer.logo && (
                <div className="ssf-logo-source-preview">
                  <img src={photographer.logo} alt="תצוגה מלאה של הלוגו" />
                </div>
              )}
              <ImageUpload
                onUpload={([path]) => path && updateConfig('photographer.logo', path)}
                label={photographer.logo ? 'החלפת לוגו' : 'העלאת לוגו'}
              />
              <FieldLabel>צורת המסגרת</FieldLabel>
              <select value={logoStyle.frameShape || 'none'} onChange={(event) => updateConfig('sections.hero.logoStyle.frameShape', event.target.value)} style={inputStyle}>
                <option value="none">ללא מסגרת</option>
                <option value="circle">עגולה</option>
                <option value="square">מרובעת</option>
                <option value="soft-square">מרובעת רכה</option>
              </select>
              <RangeControl label="גודל" value={logoStyle.size ?? 132} min={72} max={260} suffix="px" onChange={(value) => updateConfig('sections.hero.logoStyle.size', value)} />
              <RangeControl label="ריווח פנימי" value={logoStyle.padding ?? 16} min={0} max={44} suffix="px" onChange={(value) => updateConfig('sections.hero.logoStyle.padding', value)} />
              {(logoStyle.frameShape || 'none') !== 'none' && (
                <>
                  <ColorControl label="צבע מילוי" value={logoStyle.backgroundColor || '#ffffff'} onChange={(value) => updateConfig('sections.hero.logoStyle.backgroundColor', value)} />
                  <RangeControl label="שקיפות המילוי" value={logoStyle.backgroundOpacity ?? 0.9} min={0} max={1} step={0.01} onChange={(value) => updateConfig('sections.hero.logoStyle.backgroundOpacity', value)} />
                  <ColorControl label="צבע מסגרת" value={logoStyle.borderColor || '#ffffff'} onChange={(value) => updateConfig('sections.hero.logoStyle.borderColor', value)} />
                  <RangeControl label="עובי מסגרת" value={logoStyle.borderWidth ?? 1} min={0} max={8} suffix="px" onChange={(value) => updateConfig('sections.hero.logoStyle.borderWidth', value)} />
                </>
              )}
              <Toggle checked={logoStyle.shadowEnabled === true} onChange={(value) => updateConfig('sections.hero.logoStyle.shadowEnabled', value)}>צל למסגרת</Toggle>
            </details>
          </section>
        )}

        {activeTab === 'covers' && (
          <section>
            <PanelHeading
              title={`תמונות קאבר (${images.length})`}
              description="בחרו תמונה מהרשימה וערכו רק אותה. בחירת תמונה מציגה אותה מיד באתר ועוצרת זמנית את המצגת."
            />

            <div className="ssf-hero-transition-controls">
              <label>
                <span>סוג מעבר</span>
                <select value={hero.transition || 'dissolve'} onChange={(event) => updateConfig('sections.hero.transition', event.target.value)} style={inputStyle}>
                  <option value="dissolve">דיזולב עדין</option>
                  <option value="pan">תנועת Pan</option>
                  <option value="soft-zoom">זום רך עם דיזולב</option>
                  <option value="still">תמונה יציבה</option>
                </select>
              </label>
              <div className="ssf-frame-controls__pair">
                <RangeControl label="זמן לתמונה" value={hero.slideDuration ?? 5.5} min={2} max={15} step={0.5} suffix=" שנ׳" onChange={(value) => updateConfig('sections.hero.slideDuration', value)} />
                <RangeControl label="רכות המעבר" value={hero.transitionDuration ?? 1.2} min={0.2} max={3} step={0.1} suffix=" שנ׳" onChange={(value) => updateConfig('sections.hero.transitionDuration', value)} />
              </div>
            </div>

            {images.length > 0 && (
              <div className="ssf-cover-master-list" aria-label="סדר תמונות הקאבר">
                {images.map((item, index) => (
                  <article
                    key={`${item.src}-${index}`}
                    className={`ssf-cover-master-item${index === selectedIndex ? ' is-active' : ''}`}
                    draggable
                    onDragStart={() => setDraggedIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedIndex !== null) moveImage(draggedIndex, index);
                      setDraggedIndex(null);
                    }}
                    onDragEnd={() => setDraggedIndex(null)}
                  >
                    <button
                      type="button"
                      className="ssf-cover-master-item__select"
                      onClick={() => {
                        setSelectedIndex(index);
                        setDeleteIndex(null);
                        dispatchHeroPreview(item.src);
                      }}
                      aria-current={index === selectedIndex ? 'true' : undefined}
                    >
                      <span className="ssf-cover-master-item__thumb"><img src={item.src} alt="" /></span>
                      <span className="ssf-cover-master-item__name">{index + 1}. {item.src.split('/').pop()}</span>
                    </button>
                    <div className="ssf-cover-master-item__actions">
                      <button type="button" onClick={() => moveImage(index, index - 1)} disabled={index === 0} aria-label="העבר תמונה למעלה">↑</button>
                      <button type="button" onClick={() => moveImage(index, index + 1)} disabled={index === images.length - 1} aria-label="העבר תמונה למטה">↓</button>
                      <button type="button" className="is-danger" onClick={() => setDeleteIndex(index)} aria-label="הסר תמונה">הסר</button>
                    </div>
                    {deleteIndex === index && (
                      <div className="ssf-cover-delete-confirm" role="alert">
                        <span>להסיר את התמונה מהקאבר?</span>
                        <button type="button" onClick={() => deleteImage(index)}>כן, להסיר</button>
                        <button type="button" onClick={() => setDeleteIndex(null)}>ביטול</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            <div className="ssf-hero-upload">
              <ImageUpload
                multiple
                onUpload={(paths, media = []) => {
                  const additions = paths.map((src) => {
                    const uploaded = media.find((item) => item.path === src) || {};
                    const coverFocus = uploaded.coverFocus;
                    const seed = normalizeHeroImage({ src, coverFocus });
                    const recommended = getRecommendedHeroFrame(seed);
                    const recommendedAvailable = hasRecommendedHeroFrame(seed);
                    return normalizeHeroImage({
                      src,
                      coverFocus,
                      safeArea: coverFocus?.safeArea,
                      dimensions: { width: uploaded.width || 0, height: uploaded.height || 0 },
                      width: uploaded.width || 0,
                      height: uploaded.height || 0,
                      faceCount: coverFocus?.faceCount || 0,
                      frames: { desktop: recommended, mobile: recommended },
                      frameMode: {
                        desktop: recommendedAvailable ? 'recommended' : 'free',
                        mobile: recommendedAvailable ? 'recommended' : 'free',
                      },
                    });
                  });
                  updateImages([...images, ...additions]);
                  if (additions.length) {
                    setSelectedIndex(images.length);
                    dispatchHeroPreview(additions[0].src);
                  }
                }}
                label="הוספת תמונות קאבר"
              />
            </div>

            {selectedImage && (
              <div className="ssf-cover-detail">
                <div className="ssf-hero-cover-toolbar">
                  <div className="ssf-hero-device-switch" role="group" aria-label="חיתוך לפי מסך">
                    <button type="button" className={frameDevice === 'desktop' ? 'is-active' : ''} onClick={() => setFrameDevice('desktop')}>דסקטופ</button>
                    <button type="button" className={frameDevice === 'mobile' ? 'is-active' : ''} onClick={() => setFrameDevice('mobile')}>מובייל</button>
                  </div>
                  <div className="ssf-hero-mode-switch" role="group" aria-label="מצב מיקוד">
                    <button
                      type="button"
                      disabled={!hasRecommendedHeroFrame(selectedImage)}
                      className={selectedImage.frameMode?.[frameDevice] === 'recommended' ? 'is-active' : ''}
                      onClick={() => updateSelectedImage((image) => ({
                        ...image,
                        frameMode: { ...image.frameMode, [frameDevice]: 'recommended' },
                      }))}
                    >
                      מיקום מומלץ
                    </button>
                    <button
                      type="button"
                      className={selectedImage.frameMode?.[frameDevice] !== 'recommended' ? 'is-active' : ''}
                      onClick={() => updateSelectedImage((image) => ({
                        ...image,
                        frames: { ...image.frames, [frameDevice]: getHeroFrame(image, frameDevice) },
                        frameMode: { ...image.frameMode, [frameDevice]: 'free' },
                      }))}
                    >
                      מיקום חופשי
                    </button>
                  </div>
                </div>

                {hasRecommendedHeroFrame(selectedImage) && (
                  <p className="ssf-face-focus-note">
                    {selectedImage.coverFocus?.method === 'faces'
                      ? `מיקוד פנים אוטומטי · ${selectedImage.faceCount || selectedImage.coverFocus?.faceCount || 1} פנים נשמרות באזור הבטוח`
                      : 'מיקוד אוטומטי באזור העניין של התמונה'}
                  </p>
                )}

                <ImageFrameEditor
                  key={`${selectedImage.src}-${frameDevice}`}
                  src={selectedImage.src}
                  value={getHeroFrame(selectedImage, frameDevice)}
                  onChange={(frame) => updateSelectedImage((image) => ({
                    ...image,
                    ...(frameDevice === 'desktop' ? frame : {}),
                    frames: { ...image.frames, [frameDevice]: frame },
                    frameMode: { ...image.frameMode, [frameDevice]: 'free' },
                  }))}
                  label={`חיתוך ${frameDevice === 'desktop' ? 'לדסקטופ' : 'למובייל'}`}
                  aspectRatio={frameDevice === 'desktop' ? '16 / 9' : '9 / 16'}
                  showSourcePreview
                  onInteractionStart={() => dispatchHeroPreview(selectedImage.src)}
                  onInteractionEnd={() => dispatchHeroPreview(selectedImage.src)}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
