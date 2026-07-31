import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorPanelState } from '../EditorContext';
import ImageUpload from '../ImageUpload';
import { IS_STATIC_PREVIEW } from '../../utils/deployment';
import ImageFrameEditor from '../ImageFrameEditor';
import PanelTabs from '../PanelTabs';
import TypographyControls, { FieldLabel } from '../TypographyControls';
import {
  getCoverFrameStyle,
  hasManualCoverFrame,
  normalizeCoverFrame,
} from '../../utils/imageFrame';
import { getSectionTypography } from '../../utils/sectionStyles';

const FONT_FAMILY = 'Heebo, sans-serif';
const BORDER_COLOR = 'var(--ssf-border)';
const MUTED_COLOR = 'var(--ssf-muted)';
const ACCENT_COLOR = 'var(--ssf-violet)';

const inputStyle = {
  width: '100%',
  minHeight: '44px',
  padding: '0.65rem 0.75rem',
  border: `1px solid ${BORDER_COLOR}`,
  borderRadius: '10px',
  fontFamily: FONT_FAMILY,
  fontSize: '0.88rem',
  color: 'var(--ssf-text)',
  background: 'var(--ssf-surface)',
  outline: 'none',
  boxSizing: 'border-box',
};

const secondaryButtonStyle = {
  minHeight: '44px',
  padding: '0.55rem 0.9rem',
  border: `1px solid ${BORDER_COLOR}`,
  borderRadius: '10px',
  background: 'var(--ssf-surface)',
  color: 'var(--ssf-text)',
  fontFamily: FONT_FAMILY,
  fontSize: '0.78rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const primaryButtonStyle = {
  ...secondaryButtonStyle,
  borderColor: ACCENT_COLOR,
  background: 'var(--ssf-brand-soft)',
  color: 'var(--ssf-violet)',
  fontWeight: 600,
};

const dangerButtonStyle = {
  ...secondaryButtonStyle,
  borderColor: 'color-mix(in srgb, var(--ssf-danger) 35%, var(--ssf-border))',
  color: 'var(--ssf-danger)',
  background: 'color-mix(in srgb, var(--ssf-danger) 8%, var(--ssf-surface))',
};

function TextInput({ value, onChange, placeholder, type = 'text', ...props }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={props['aria-label'] || placeholder}
      style={inputStyle}
      onFocus={(event) => { event.target.style.borderColor = ACCENT_COLOR; }}
      onBlur={(event) => { event.target.style.borderColor = BORDER_COLOR; }}
      {...props}
    />
  );
}

function TextArea({ value, onChange, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={placeholder}
      rows={4}
      style={{
        ...inputStyle,
        minHeight: '108px',
        resize: 'vertical',
        lineHeight: 1.65,
      }}
      onFocus={(event) => { event.target.style.borderColor = ACCENT_COLOR; }}
      onBlur={(event) => { event.target.style.borderColor = BORDER_COLOR; }}
    />
  );
}

function PanelHeading({ title, description, aside = null }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.8rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ minWidth: 0 }}>
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
              margin: '0.28rem 0 0',
              color: MUTED_COLOR,
              fontFamily: FONT_FAMILY,
              fontSize: '0.74rem',
              lineHeight: 1.55,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {aside}
    </div>
  );
}

function Divider() {
  return <div aria-hidden="true" style={{ height: '1px', background: 'var(--ssf-border)', margin: '1.25rem 0' }} />;
}

function toCssAspectRatio(value) {
  return String(value || '2:3').replace(':', ' / ');
}

function getPreviewAspectRatio(layoutType, eventAspectRatio) {
  if (layoutType === 'stories') return '4 / 5';
  if (layoutType === 'grid') return '3 / 2';
  return toCssAspectRatio(eventAspectRatio || '2:3');
}

function getPreviewContainerStyle(layoutType) {
  if (layoutType === 'grid') {
    return { borderRadius: '0.75rem' };
  }

  return { borderRadius: '0px' };
}

function getEventKey(item, index) {
  if (item.galleryKey !== undefined && item.galleryKey !== null) {
    return `gallery-${String(item.galleryKey)}`;
  }
  if (item.id !== undefined && item.id !== null) {
    return `event-${String(item.id)}`;
  }
  return `index-${index}`;
}

function clearCoverFrame(item) {
  const {
    coverX: _coverX,
    coverY: _coverY,
    coverZoom: _coverZoom,
    coverFrameSource: _coverFrameSource,
    ...rest
  } = item;
  return rest;
}

function GalleryPreviewOverlay({ layoutType, item, typography }) {
  const category = item.category || 'קטגוריה';
  const title = item.title || 'שם האירוע';

  if (layoutType === 'grid') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.28) 48%, rgba(0,0,0,0.08) 100%)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '1rem 0.9rem',
        }}
      >
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '0.3rem', color: 'var(--color-accent)', fontFamily: typography.bodyFamily }}>
            {category}
          </div>
          <div style={{ fontSize: '1.05rem', lineHeight: 1.15, fontFamily: typography.headingFamily }}>
            {title}
          </div>
        </div>
      </div>
    );
  }

  if (layoutType === 'masonry') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.42)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '0.24rem', fontFamily: typography.bodyFamily }}>
            {category}
          </div>
          <div style={{ fontSize: '0.92rem', lineHeight: 1.2, fontFamily: typography.headingFamily }}>
            {title}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(28,28,28,0.45)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.38rem',
        padding: '1rem',
      }}
    >
      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.86)', fontFamily: typography.bodyFamily }}>
        {category}
      </div>
      <div style={{ fontSize: '1.12rem', lineHeight: 1.16, color: '#fff', textAlign: 'center', fontFamily: typography.headingFamily }}>
        {title}
      </div>
    </div>
  );
}

function EventList({
  items,
  layoutType,
  onSelect,
  onAdd,
  selectedEventKey,
}) {
  return (
    <div>
      <PanelHeading
        title="האירועים שלכם"
        description="בחרו אירוע כדי לערוך את הפרטים, הקאבר והתמונות שלו."
        aside={(
          <span
            style={{
              minWidth: '2rem',
              height: '2rem',
              borderRadius: '999px',
              background: 'var(--ssf-brand-soft)',
              color: 'var(--ssf-violet)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT_FAMILY,
              fontSize: '0.72rem',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {items.length}
          </span>
        )}
      />

      {items.length === 0 ? (
        <div
          style={{
            padding: '1.5rem 1rem',
            border: `1px dashed ${BORDER_COLOR}`,
            borderRadius: '14px',
            background: 'var(--ssf-brand-soft)',
            textAlign: 'center',
            color: MUTED_COLOR,
            fontFamily: FONT_FAMILY,
            fontSize: '0.8rem',
            lineHeight: 1.6,
          }}
        >
          עדיין לא נוצרו אירועים. הוסיפו אירוע ראשון והתחילו לבחור תמונות.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          {items.map((item, index) => {
            const itemKey = getEventKey(item, index);
            const images = item.images || [];
            const previewAspectRatio = getPreviewAspectRatio(layoutType, item.aspectRatio);
            return (
              <button
                key={itemKey}
                type="button"
                onClick={() => onSelect(itemKey)}
                aria-current={selectedEventKey === itemKey ? 'true' : undefined}
                style={{
                  width: '100%',
                  minHeight: '68px',
                  padding: '0.55rem',
                  border: `1px solid ${selectedEventKey === itemKey ? ACCENT_COLOR : BORDER_COLOR}`,
                  borderRadius: '12px',
                  background: selectedEventKey === itemKey ? 'var(--ssf-brand-soft)' : 'var(--ssf-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.7rem',
                  textAlign: 'right',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '52px',
                    borderRadius: layoutType === 'grid' ? '8px' : '4px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: 'var(--ssf-brand-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.coverImage ? (
                    <img
                      src={item.coverImage}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        aspectRatio: previewAspectRatio,
                        objectFit: 'cover',
                        display: 'block',
                        ...getCoverFrameStyle(item),
                      }}
                    />
                  ) : (
                    <span aria-hidden="true" style={{ color: 'var(--ssf-muted)', fontSize: '1rem' }}>▧</span>
                  )}
                </div>

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--ssf-text)',
                      fontFamily: FONT_FAMILY,
                      fontSize: '0.86rem',
                      fontWeight: 600,
                    }}
                  >
                    {item.title || `אירוע ${index + 1}`}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      marginTop: '0.16rem',
                      color: MUTED_COLOR,
                      fontFamily: FONT_FAMILY,
                      fontSize: '0.7rem',
                    }}
                  >
                    {item.category || 'ללא קטגוריה'} · {images.length} תמונות
                  </span>
                </span>

                <span aria-hidden="true" style={{ color: 'var(--ssf-muted)', fontSize: '1.05rem', flexShrink: 0 }}>‹</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        style={{
          ...primaryButtonStyle,
          width: '100%',
          marginTop: '0.8rem',
          borderStyle: 'dashed',
        }}
      >
        + הוספת אירוע חדש
      </button>
    </div>
  );
}

function EventDetail({
  event,
  index,
  categories,
  onUpdate,
  onRemove,
  onBack,
  layoutType,
  typography,
  activeTab,
  onTabChange,
}) {
  const [isAnalyzingCover, setIsAnalyzingCover] = useState(false);
  const [autoCoverError, setAutoCoverError] = useState('');
  const [confirmEventRemoval, setConfirmEventRemoval] = useState(false);
  const [pendingImageRemoval, setPendingImageRemoval] = useState(null);
  const eventRef = useRef(event);
  const analysisRequestRef = useRef(0);
  const images = event.images || [];
  const frame = normalizeCoverFrame(event);
  const isManualCover = event.coverMode === 'manual';
  const automaticCover = event.autoCover;
  const hasAutomaticFaceFocus = (
    event.coverFocus?.source === event.coverImage
    && event.coverFocus?.method === 'faces'
  );
  const previewAspectRatio = getPreviewAspectRatio(layoutType, event.aspectRatio);

  useEffect(() => {
    eventRef.current = event;
  }, [event]);

  useEffect(() => () => {
    analysisRequestRef.current += 1;
  }, []);

  const cancelAutomaticAnalysis = () => {
    analysisRequestRef.current += 1;
    setIsAnalyzingCover(false);
  };

  const refreshAutomaticCover = async (candidateEvent) => {
    if (IS_STATIC_PREVIEW) {
      setAutoCoverError('ניתוח פנים מחדש זמין בגרסה המקומית. הקאבר והחיתוך הקיימים נשמרים בדמו.');
      return;
    }
    const candidateImages = candidateEvent.images || [];
    if (!candidateImages.length) return;

    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;
    setIsAnalyzingCover(true);
    setAutoCoverError('');

    try {
      const response = await fetch('/api/auto-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: candidateEvent.id,
          galleryKey: candidateEvent.galleryKey || candidateEvent.id,
          images: candidateImages,
          imageMetadata: candidateEvent.imageMetadata || {},
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.analysis?.coverSource) {
        throw new Error(payload.error || 'Automatic cover analysis failed');
      }
      if (analysisRequestRef.current !== requestId) return;

      const current = eventRef.current;
      const currentImages = current.images || [];
      if (
        current.coverMode === 'manual'
        || currentImages.length !== candidateImages.length
        || currentImages.some((source, currentIndex) => (
          source !== candidateImages[currentIndex]
        ))
      ) {
        return;
      }

      const analysis = payload.analysis;
      const source = currentImages.includes(analysis.coverSource)
        ? analysis.coverSource
        : '';
      if (!source) return;

      const previousAuto = current.autoCover || {};
      const previousImages = [...new Set([
        ...(previousAuto.previousImages || []),
        previousAuto.image,
        current.coverMode !== 'manual' ? current.coverImage : '',
      ].filter(Boolean))];
      const focus = analysis.coverFocus?.source === source
        ? analysis.coverFocus
        : null;
      const metadata = current.imageMetadata?.[source];
      const withoutFrame = clearCoverFrame(current);
      const {
        coverFocus: _coverFocus,
        ...withoutOldFocus
      } = withoutFrame;
      const nextEvent = {
        ...withoutOldFocus,
        coverMode: 'auto',
        autoCover: {
          image: source,
          ...(focus ? { focus } : {}),
          score: analysis.confidence || 0,
          algorithm: analysis.method || 'couple-cover',
          version: analysis.version || 1,
          previousImages,
        },
        coverImage: source,
        ...(focus ? { coverFocus: focus } : {}),
        ...(metadata
          ? { aspectRatio: metadata.height > metadata.width ? '2:3' : '3:2' }
          : {}),
      };
      eventRef.current = nextEvent;
      onUpdate(nextEvent);
    } catch {
      if (analysisRequestRef.current === requestId) {
        setAutoCoverError('לא הצלחנו לנתח מחדש כרגע. הקאבר הקיים נשמר.');
      }
    } finally {
      if (analysisRequestRef.current === requestId) {
        setIsAnalyzingCover(false);
      }
    }
  };

  const selectManualCover = (source, detectedFocus, suppliedMetadata) => {
    cancelAutomaticAnalysis();
    const next = clearCoverFrame(event);
    const metadata = suppliedMetadata || event.imageMetadata?.[source];
    const matchingFocus = detectedFocus?.source === source ? detectedFocus : null;
    const {
      coverFocus: _coverFocus,
      ...withoutOldFocus
    } = next;

    const nextEvent = {
      ...withoutOldFocus,
      coverMode: 'manual',
      coverImage: source,
      ...(matchingFocus ? { coverFocus: matchingFocus } : {}),
      ...(metadata
        ? { aspectRatio: metadata.height > metadata.width ? '2:3' : '3:2' }
        : {}),
    };
    eventRef.current = nextEvent;
    onUpdate(nextEvent);
  };

  const restoreAutomaticCover = () => {
    if (!automaticCover?.image) return;
    cancelAutomaticAnalysis();
    const next = clearCoverFrame(event);
    const metadata = event.imageMetadata?.[automaticCover.image];
    const {
      coverFocus: _coverFocus,
      ...withoutOldFocus
    } = next;

    const nextEvent = {
      ...withoutOldFocus,
      coverMode: 'auto',
      coverImage: automaticCover.image,
      ...(automaticCover.focus ? { coverFocus: automaticCover.focus } : {}),
      ...(metadata
        ? { aspectRatio: metadata.height > metadata.width ? '2:3' : '3:2' }
        : {}),
    };
    eventRef.current = nextEvent;
    onUpdate(nextEvent);
  };

  const removeImage = (imageIndex) => {
    const source = images[imageIndex];
    const nextImages = images.filter((_, currentIndex) => currentIndex !== imageIndex);
    const nextMetadata = { ...(event.imageMetadata || {}) };
    if (!nextImages.includes(source)) delete nextMetadata[source];
    onUpdate({
      ...event,
      images: nextImages,
      imageMetadata: nextMetadata,
    });
    setPendingImageRemoval(null);
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          minHeight: '44px',
          margin: '-0.25rem -0.45rem 0.2rem 0',
          padding: '0.35rem 0.45rem',
          border: 0,
          background: 'transparent',
          color: 'var(--ssf-muted)',
          fontFamily: FONT_FAMILY,
          fontSize: '0.76rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
        }}
      >
        <span aria-hidden="true">›</span>
        כל האירועים
      </button>

      <PanelHeading
        title={event.title || `אירוע ${index + 1}`}
        description={`${event.category || 'ללא קטגוריה'} · ${images.length} תמונות`}
      />

      <PanelTabs
        tabs={[
          { id: 'details', label: 'פרטים' },
          { id: 'cover', label: 'קאבר' },
          { id: 'photos', label: 'תמונות', badge: images.length },
        ]}
        value={activeTab}
        onChange={onTabChange}
        ariaLabel="עריכת אירוע"
      />

      <div
        role="tabpanel"
        aria-label={activeTab === 'details' ? 'פרטי האירוע' : activeTab === 'cover' ? 'קאבר האירוע' : 'תמונות האירוע'}
        style={{ paddingTop: '1.05rem' }}
      >
        {activeTab === 'details' && (
          <div>
            <PanelHeading title="פרטי האירוע" description="המידע שמופיע בכרטיס ובדף הגלריה." />

            <FieldLabel>שם האירוע</FieldLabel>
            <TextInput
              value={event.title || ''}
              onChange={(eventValue) => onUpdate({ ...event, title: eventValue.target.value })}
              placeholder="שם הזוג / האירוע"
            />

            <FieldLabel>קטגוריה</FieldLabel>
            <select
              value={event.category || ''}
              onChange={(eventValue) => onUpdate({ ...event, category: eventValue.target.value })}
              aria-label="קטגוריית האירוע"
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {categories.filter((category) => category !== 'הכל').map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <FieldLabel>תיאור האירוע</FieldLabel>
            <TextArea
              value={event.description || ''}
              onChange={(eventValue) => onUpdate({ ...event, description: eventValue.target.value })}
              placeholder="תיאור קצר שיופיע בראש הגלריה"
            />

            <Divider />

            <PanelHeading
              title="מחיקת האירוע"
              description="מחיקה תסיר את האירוע מהאתר יחד עם כל ההגדרות שלו."
            />
            {!confirmEventRemoval ? (
              <button
                type="button"
                onClick={() => setConfirmEventRemoval(true)}
                style={{ ...dangerButtonStyle, width: '100%' }}
              >
                מחיקת האירוע
              </button>
            ) : (
              <div
                role="alert"
                style={{
                  padding: '0.85rem',
                  border: '1px solid color-mix(in srgb, var(--ssf-danger) 35%, var(--ssf-border))',
                  borderRadius: '12px',
                  background: 'color-mix(in srgb, var(--ssf-danger) 8%, var(--ssf-surface))',
                }}
              >
                <p style={{ margin: '0 0 0.75rem', color: 'var(--ssf-danger)', fontFamily: FONT_FAMILY, fontSize: '0.78rem', lineHeight: 1.55 }}>
                  למחוק את האירוע לצמיתות?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setConfirmEventRemoval(false)}
                    style={{ ...secondaryButtonStyle, flex: 1 }}
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={onRemove}
                    style={{ ...dangerButtonStyle, flex: 1, background: 'var(--ssf-danger)', color: '#fff', borderColor: 'var(--ssf-danger)' }}
                  >
                    כן, למחוק
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cover' && (
          <div>
            <PanelHeading
              title="תמונת הקאבר"
              description="המערכת בוחרת תמונה זוגית כברירת מחדל. אפשר להחליף ולכוון ידנית."
            />

            <div
              style={{
                padding: '0.75rem',
                marginBottom: '0.8rem',
                border: `1px solid ${isManualCover ? BORDER_COLOR : 'var(--ssf-cyan)'}`,
                borderRadius: '12px',
                background: isManualCover ? 'var(--ssf-surface)' : 'var(--ssf-brand-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.55rem',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    color: 'var(--ssf-text)',
                    fontFamily: FONT_FAMILY,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  {isAnalyzingCover
                    ? 'מנתח את הזוג ובוחר קאבר…'
                    : isManualCover
                      ? 'קאבר בבחירה ידנית'
                      : automaticCover?.image
                        ? 'קאבר זוגי שנבחר אוטומטית'
                        : 'הקאבר ייבחר לאחר הוספת תמונות'}
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: '0.16rem',
                    color: MUTED_COLOR,
                    fontFamily: FONT_FAMILY,
                    fontSize: '0.68rem',
                  }}
                >
                  {isManualCover ? 'הבחירה לא תשתנה בהעלאת תמונות חדשות.' : 'הבחירה נשמרת ומתעדכנת רק לפי תמונות האירוע.'}
                </span>
              </div>

              {isManualCover && automaticCover?.image && (
                <button type="button" onClick={restoreAutomaticCover} style={secondaryButtonStyle}>
                  חזרה לאוטומטי
                </button>
              )}
              {!isManualCover && automaticCover?.image && !isAnalyzingCover && (
                <button
                  type="button"
                  onClick={() => refreshAutomaticCover(event)}
                  disabled={IS_STATIC_PREVIEW}
                  title={IS_STATIC_PREVIEW ? 'זמין בגרסה המקומית' : undefined}
                  style={secondaryButtonStyle}
                >
                  ניתוח ובחירה מחדש
                </button>
              )}
            </div>

            {autoCoverError && (
              <p role="alert" style={{ margin: '0 0 0.75rem', color: 'var(--ssf-danger)', fontFamily: FONT_FAMILY, fontSize: '0.72rem' }}>
                {autoCoverError}
              </p>
            )}

            <ImageUpload
              preview={event.coverImage}
              onUpload={([path], media) => {
                const uploaded = media.find((item) => item.path === path);
                selectManualCover(path, uploaded?.coverFocus, uploaded);
              }}
              label="העלאת קאבר חלופי"
            />

            {hasAutomaticFaceFocus && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginTop: '0.65rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  background: 'var(--ssf-brand-soft)',
                  color: 'var(--ssf-muted)',
                  fontFamily: FONT_FAMILY,
                  fontSize: '0.7rem',
                }}
              >
                <span>מיקוד פנים אוטומטי · {event.coverFocus.faceCount} פנים</span>
                {hasManualCoverFrame(event) && (
                  <button
                    type="button"
                    onClick={() => {
                      const {
                        coverX: _coverX,
                        coverY: _coverY,
                        coverZoom: _coverZoom,
                        coverFrameSource: _coverFrameSource,
                        ...automaticEvent
                      } = event;
                      onUpdate(automaticEvent);
                    }}
                    style={{
                      ...secondaryButtonStyle,
                      padding: '0.35rem 0.65rem',
                      background: 'transparent',
                    }}
                  >
                    איפוס מיקום
                  </button>
                )}
              </div>
            )}

            {event.coverImage && (
              <ImageFrameEditor
                src={event.coverImage}
                value={frame}
                onChange={(value) => onUpdate({
                  ...event,
                  coverX: value.x,
                  coverY: value.y,
                  coverZoom: value.zoom,
                  coverFrameSource: event.coverImage,
                })}
                label="מיקום וחיתוך בתצוגה"
                aspectRatio={previewAspectRatio}
                previewStyle={getPreviewContainerStyle(layoutType)}
                previewOverlay={(
                  <GalleryPreviewOverlay
                    layoutType={layoutType}
                    item={event}
                    typography={typography}
                  />
                )}
              />
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div>
            <PanelHeading
              title="תמונות האירוע"
              description="הוסיפו תמונות, החליפו קאבר או הסירו תמונה מהגלריה."
            />

            {images.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
                  gap: '0.65rem',
                  marginBottom: '0.9rem',
                }}
              >
                {images.map((src, imageIndex) => {
                  const isCover = src === event.coverImage;
                  return (
                    <div
                      key={`${src}-${imageIndex}`}
                      style={{
                        border: `1px solid ${isCover ? ACCENT_COLOR : BORDER_COLOR}`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'var(--ssf-surface)',
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img
                          src={src}
                          alt={`תמונה ${imageIndex + 1} באירוע`}
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                        />
                        {isCover && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '0.4rem',
                              right: '0.4rem',
                              padding: '0.22rem 0.45rem',
                              borderRadius: '999px',
                              background: 'color-mix(in srgb, var(--ssf-violet) 94%, transparent)',
                              color: '#fff',
                              fontFamily: FONT_FAMILY,
                              fontSize: '0.6rem',
                              fontWeight: 600,
                            }}
                          >
                            קאבר
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderTop: `1px solid ${BORDER_COLOR}` }}>
                        <button
                          type="button"
                          onClick={() => selectManualCover(
                            src,
                            automaticCover?.image === src ? automaticCover.focus : null,
                          )}
                          disabled={isCover}
                          style={{
                            minHeight: '44px',
                            padding: '0.35rem 0.45rem',
                            border: 0,
                            borderLeft: `1px solid ${BORDER_COLOR}`,
                            background: isCover ? 'var(--ssf-brand-soft)' : 'var(--ssf-surface)',
                            color: isCover ? 'var(--ssf-violet)' : 'var(--ssf-muted)',
                            fontFamily: FONT_FAMILY,
                            fontSize: '0.65rem',
                            cursor: isCover ? 'default' : 'pointer',
                          }}
                        >
                          {isCover ? 'קאבר נוכחי' : 'הגדרה כקאבר'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingImageRemoval(imageIndex)}
                          aria-label={`מחיקת תמונה ${imageIndex + 1}`}
                          style={{
                            minWidth: '44px',
                            minHeight: '44px',
                            padding: '0.3rem',
                            border: 0,
                            background: 'var(--ssf-surface)',
                            color: 'var(--ssf-danger)',
                            fontFamily: FONT_FAMILY,
                            fontSize: '0.64rem',
                            cursor: 'pointer',
                          }}
                        >
                          מחיקה
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  marginBottom: '0.9rem',
                  padding: '1.25rem 1rem',
                  border: `1px dashed ${BORDER_COLOR}`,
                  borderRadius: '12px',
                  background: 'var(--ssf-brand-soft)',
                  color: MUTED_COLOR,
                  fontFamily: FONT_FAMILY,
                  fontSize: '0.78rem',
                  lineHeight: 1.55,
                  textAlign: 'center',
                }}
              >
                אין עדיין תמונות באירוע הזה.
              </div>
            )}

            {pendingImageRemoval !== null && images[pendingImageRemoval] && (
              <div
                role="alertdialog"
                aria-label="אישור מחיקת תמונה"
                style={{
                  marginBottom: '0.85rem',
                  padding: '0.8rem',
                  border: '1px solid color-mix(in srgb, var(--ssf-danger) 35%, var(--ssf-border))',
                  borderRadius: '12px',
                  background: 'color-mix(in srgb, var(--ssf-danger) 8%, var(--ssf-surface))',
                }}
              >
                <p style={{ margin: '0 0 0.65rem', color: 'var(--ssf-danger)', fontFamily: FONT_FAMILY, fontSize: '0.76rem' }}>
                  להסיר את התמונה מהאירוע?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setPendingImageRemoval(null)}
                    style={{ ...secondaryButtonStyle, flex: 1 }}
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(pendingImageRemoval)}
                    style={{ ...dangerButtonStyle, flex: 1 }}
                  >
                    הסרת התמונה
                  </button>
                </div>
              </div>
            )}

            <ImageUpload
              multiple
              onUpload={(paths, media) => {
                const nextMetadata = { ...(event.imageMetadata || {}) };
                media.forEach((uploaded) => {
                  if (uploaded.width > 0 && uploaded.height > 0) {
                    nextMetadata[uploaded.path] = {
                      width: uploaded.width,
                      height: uploaded.height,
                    };
                  }
                });
                const nextEvent = {
                  ...event,
                  coverMode: event.coverMode || 'auto',
                  images: [...images, ...paths],
                  imageMetadata: nextMetadata,
                };
                eventRef.current = nextEvent;
                onUpdate(nextEvent);
                if (event.coverMode !== 'manual') {
                  refreshAutomaticCover(nextEvent);
                }
              }}
              label="הוספת תמונות לאירוע"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function GalleryPanel() {
  const { config, updateConfig } = useEditor();
  const gallery = config.sections?.gallery || {};
  const categories = config.categories || ['הכל'];
  const items = config.galleryItems || [];
  const [activeTab, setActiveTab] = useEditorPanelState('gallery', 'activeTab', 'events');
  const [eventDetailTab, setEventDetailTab] = useEditorPanelState('gallery', 'eventDetailTab', 'details');
  const [selectedEventKey, setSelectedEventKey] = useEditorPanelState('gallery', 'selectedEventKey', null);
  const [newCategory, setNewCategory] = useState('');
  const [pendingCategoryRemoval, setPendingCategoryRemoval] = useState(null);
  const editableCategories = categories.filter((category) => category !== 'הכל');
  const layoutType = config.layout?.type || 'stories';
  const typography = getSectionTypography(config, 'gallery');
  const selectedEventIndex = selectedEventKey === null
    ? -1
    : items.findIndex((item, index) => getEventKey(item, index) === selectedEventKey);
  const selectedEvent = selectedEventIndex >= 0 ? items[selectedEventIndex] : null;

  useEffect(() => {
    if (selectedEventKey !== null && selectedEventIndex < 0) {
      setSelectedEventKey(null);
    }
  }, [selectedEventIndex, selectedEventKey]);

  const updateEvent = (index, updatedEvent) => {
    const next = items.map((item, itemIndex) => itemIndex === index ? updatedEvent : item);
    updateConfig('galleryItems', next);
  };

  const addEvent = () => {
    const nextEvent = {
      id: Date.now(),
      title: '',
      category: editableCategories[0] || '',
      coverImage: '',
      description: '',
      images: [],
      imageMetadata: {},
      aspectRatio: '2:3',
      coverMode: 'auto',
      coverX: 0,
      coverY: 0,
      coverZoom: 1,
    };
    updateConfig('galleryItems', [...items, nextEvent]);
    setSelectedEventKey(getEventKey(nextEvent, items.length));
    setEventDetailTab('details');
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    updateConfig('categories', [...categories, trimmed]);
    setNewCategory('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PanelTabs
        tabs={[
          { id: 'events', label: 'אירועים', badge: items.length },
          { id: 'categories', label: 'קטגוריות', badge: editableCategories.length },
          { id: 'display', label: 'תצוגה וכותרת' },
          { id: 'external', label: 'קישור חיצוני' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="אפשרויות הגלריה"
      />

      <div
        role="tabpanel"
        aria-label={
          activeTab === 'events'
            ? 'ניהול אירועים'
            : activeTab === 'categories'
              ? 'ניהול קטגוריות'
              : activeTab === 'display'
                ? 'תצוגה וכותרת'
                : 'קישור חיצוני'
        }
      >
        {activeTab === 'events' && (
          <>
            <div style={{ display: selectedEvent ? 'none' : 'block' }}>
              <EventList
                items={items}
                layoutType={layoutType}
                selectedEventKey={selectedEventKey}
                onSelect={(itemKey) => {
                  setSelectedEventKey(itemKey);
                  setEventDetailTab('details');
                }}
                onAdd={addEvent}
              />
            </div>

            {selectedEvent && (
              <EventDetail
                key={selectedEventKey}
                event={selectedEvent}
                index={selectedEventIndex}
                categories={categories}
                onUpdate={(updatedEvent) => updateEvent(selectedEventIndex, updatedEvent)}
                onRemove={() => {
                  updateConfig(
                    'galleryItems',
                    items.filter((_, itemIndex) => itemIndex !== selectedEventIndex),
                  );
                  setSelectedEventKey(null);
                }}
                onBack={() => setSelectedEventKey(null)}
                layoutType={layoutType}
                typography={typography}
                activeTab={eventDetailTab}
                onTabChange={setEventDetailTab}
              />
            )}
          </>
        )}

        {activeTab === 'categories' && (
          <div>
            <PanelHeading
              title="קטגוריות הגלריה"
              description="הקטגוריות משמשות כפילטרים באתר. אפשר ליצור עד שבע קטגוריות לצד ״הכל״."
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div
                style={{
                  minHeight: '52px',
                  padding: '0.55rem 0.7rem',
                  borderRadius: '10px',
                  background: 'var(--ssf-brand-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ flex: 1, fontFamily: FONT_FAMILY, fontSize: '0.84rem', color: 'var(--ssf-text)', fontWeight: 500 }}>הכל</span>
                <span style={{ fontFamily: FONT_FAMILY, fontSize: '0.68rem', color: MUTED_COLOR }}>קטגוריה קבועה</span>
              </div>

              {editableCategories.map((category) => {
                const eventCount = items.filter((item) => item.category === category).length;
                const isConfirming = pendingCategoryRemoval === category;
                return (
                  <div
                    key={category}
                    style={{
                      minHeight: '52px',
                      padding: '0.4rem 0.55rem',
                      border: `1px solid ${isConfirming ? 'color-mix(in srgb, var(--ssf-danger) 35%, var(--ssf-border))' : BORDER_COLOR}`,
                      borderRadius: '10px',
                      background: isConfirming ? 'color-mix(in srgb, var(--ssf-danger) 8%, var(--ssf-surface))' : 'var(--ssf-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: FONT_FAMILY, fontSize: '0.84rem', color: 'var(--ssf-text)', fontWeight: 500 }}>{category}</span>
                      <span style={{ display: 'block', marginTop: '0.1rem', fontFamily: FONT_FAMILY, fontSize: '0.66rem', color: MUTED_COLOR }}>
                        {eventCount} אירועים
                      </span>
                    </span>

                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPendingCategoryRemoval(null)}
                          style={{ ...secondaryButtonStyle, padding: '0.35rem 0.6rem' }}
                        >
                          ביטול
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateConfig('categories', categories.filter((item) => item !== category));
                            setPendingCategoryRemoval(null);
                          }}
                          style={{ ...dangerButtonStyle, padding: '0.35rem 0.6rem' }}
                        >
                          אישור הסרה
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingCategoryRemoval(category)}
                        style={{ ...dangerButtonStyle, padding: '0.35rem 0.7rem' }}
                      >
                        הסרה
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {categories.length < 8 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', marginTop: '0.8rem' }}>
                <TextInput
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addCategory();
                  }}
                  placeholder="שם קטגוריה חדשה"
                />
                <button type="button" onClick={addCategory} style={primaryButtonStyle}>
                  הוספה
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'display' && (
          <div>
            <PanelHeading
              title="כותרת הגלריה"
              description="הכותרת והפונטים שיופיעו באזור העבודות באתר."
            />

            <FieldLabel>כותרת הסקשן</FieldLabel>
            <TextInput
              value={gallery.title || ''}
              onChange={(event) => updateConfig('sections.gallery.title', event.target.value)}
              placeholder="העבודות שלי"
            />

            <TypographyControls
              headingValue={gallery.typography?.headingFamily}
              bodyValue={gallery.typography?.bodyFamily}
              accentValue={gallery.typography?.accentFamily}
              onHeadingChange={(value) => updateConfig('sections.gallery.typography.headingFamily', value)}
              onBodyChange={(value) => updateConfig('sections.gallery.typography.bodyFamily', value)}
              onAccentChange={(value) => updateConfig('sections.gallery.typography.accentFamily', value)}
              showAccent
              accentLabel="פונט פילטרים / כפתור חיצוני"
            />

            <Divider />

            <PanelHeading
              title="פריסת הכרטיסים"
              description={`הגלריה מוצגת כרגע בפריסת ${layoutType}.`}
            />

            <FieldLabel>מספר תמונות בשורה — תצוגת ״הכל״</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', alignItems: 'center', gap: '0.7rem' }}>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={gallery.columnsAll || 3}
                onChange={(event) => updateConfig('sections.gallery.columnsAll', Number(event.target.value))}
                aria-label="מספר תמונות בשורה בתצוגת הכל"
                style={{ width: '100%' }}
              />
              <output
                style={{
                  height: '40px',
                  borderRadius: '9px',
                  background: 'var(--ssf-brand-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ssf-violet)',
                  fontFamily: FONT_FAMILY,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                {gallery.columnsAll || 3}
              </output>
            </div>

            <FieldLabel>מספר תמונות בשורה — לאחר סינון</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', alignItems: 'center', gap: '0.7rem' }}>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={gallery.columnsFiltered || 2}
                onChange={(event) => updateConfig('sections.gallery.columnsFiltered', Number(event.target.value))}
                aria-label="מספר תמונות בשורה לאחר סינון"
                style={{ width: '100%' }}
              />
              <output
                style={{
                  height: '40px',
                  borderRadius: '9px',
                  background: 'var(--ssf-brand-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ssf-violet)',
                  fontFamily: FONT_FAMILY,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                {gallery.columnsFiltered || 2}
              </output>
            </div>
          </div>
        )}

        {activeTab === 'external' && (
          <div>
            <PanelHeading
              title="קישור לעבודות נוספות"
              description="כפתור אופציונלי שמופיע אחרי הגלריה ומוביל לעמוד חיצוני."
            />

            <label
              style={{
                minHeight: '52px',
                padding: '0.65rem 0.75rem',
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontFamily: FONT_FAMILY,
                fontSize: '0.84rem',
                color: 'var(--ssf-text)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={gallery.moreCtaEnabled !== false}
                onChange={(event) => updateConfig('sections.gallery.moreCtaEnabled', event.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: ACCENT_COLOR }}
              />
              <span>
                <span style={{ display: 'block', fontWeight: 500 }}>הצגת הכפתור באתר</span>
                <span style={{ display: 'block', marginTop: '0.12rem', color: MUTED_COLOR, fontSize: '0.69rem' }}>
                  הכפתור יופיע מתחת לעבודות.
                </span>
              </span>
            </label>

            <FieldLabel>טקסט הכפתור</FieldLabel>
            <TextInput
              value={gallery.moreCtaLabel || 'בא לכם לראות עוד? לחצו כאן'}
              onChange={(event) => updateConfig('sections.gallery.moreCtaLabel', event.target.value)}
              placeholder="בא לכם לראות עוד? לחצו כאן"
            />

            <FieldLabel>כתובת הקישור</FieldLabel>
            <TextInput
              type="url"
              value={gallery.moreCtaHref || ''}
              onChange={(event) => updateConfig('sections.gallery.moreCtaHref', event.target.value)}
              placeholder="https://..."
              dir="ltr"
            />
          </div>
        )}
      </div>
    </div>
  );
}
