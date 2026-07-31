import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CircleHelp,
  Eye,
  EyeOff,
  FileText,
  Home,
  Images,
  ListTree,
  Mail,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Palette,
  PanelRightClose,
  ReceiptText,
  UserRound,
} from 'lucide-react';
import { useEditor } from './EditorContext';
import StylePanel from './panels/StylePanel';
import HeroPanel from './panels/HeroPanel';
import AboutPanel from './panels/AboutPanel';
import GalleryPanel from './panels/GalleryPanel';
import PricingPanel from './panels/PricingPanel';
import FAQPanel from './panels/FAQPanel';
import TestimonialsPanel from './panels/TestimonialsPanel';
import ContactPanel from './panels/ContactPanel';
import StructurePanel from './panels/StructurePanel';
import CustomSectionPanel from './panels/CustomSectionPanel';
import SweetLightLogo from './SweetLightLogo';
import {
  getOrderedSiteSections,
  getSiteSection,
  isCustomSectionId,
  scrollSiteSectionIntoView,
  setSiteSectionEnabled,
} from '../utils/siteSections';
import './structure-share-sheet.css';

const STRUCTURE_PANEL = {
  id: 'structure',
  label: 'מבנה',
  description: 'סדר האזורים, הצגה ואזורים אישיים',
  Icon: ListTree,
  Component: StructurePanel,
};

const STYLE_PANEL = {
  id: 'style',
  label: 'עיצוב',
  description: 'צבעים, טיפוגרפיה וטמפלייטים',
  Icon: Palette,
  Component: StylePanel,
};

const SECTION_PANELS = {
  hero: { id: 'hero', label: 'בית', description: 'כותרות, לוגו ותמונות קאבר', Icon: Home, Component: HeroPanel },
  about: { id: 'about', label: 'אודות', description: 'הסיפור, התמונה והנתונים שלך', Icon: UserRound, Component: AboutPanel },
  gallery: { id: 'gallery', label: 'גלריה', description: 'אירועים, קאברים ופריסת עבודות', Icon: Images, Component: GalleryPanel },
  pricing: { id: 'pricing', label: 'הצעת מחיר', description: 'חבילות, שירותים, מחירים ותמונות', Icon: ReceiptText, Component: PricingPanel },
  testimonials: { id: 'testimonials', label: 'המלצות', description: 'המלצות, שמות ותמונות לקוחות', Icon: MessageSquareQuote, Component: TestimonialsPanel },
  faq: { id: 'faq', label: 'שאלות', description: 'שאלות נפוצות ותשובות', Icon: CircleHelp, Component: FAQPanel },
  contact: { id: 'contact', label: 'קשר', description: 'טקסטים וערוצי יצירת קשר', Icon: Mail, Component: ContactPanel },
};

const MOBILE_QUERY = '(max-width: 1023px)';
const MOBILE_TOOLBAR_HEIGHT = 68;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getSheetMetrics() {
  if (typeof window === 'undefined') return { min: 300, partial: 440, max: 700 };
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const max = Math.max(190, viewportHeight - MOBILE_TOOLBAR_HEIGHT - 8);
  const min = Math.min(max, Math.max(220, viewportHeight * 0.36));
  const partial = clamp(viewportHeight * 0.56, min, max);
  return { min, partial, max };
}

function getPanels(config) {
  const sectionPanels = getOrderedSiteSections(config).map((section) => {
    if (!section.custom) return SECTION_PANELS[section.id];
    return {
      id: section.id,
      label: section.editorLabel,
      description: 'טקסטים, תמונות ופריסה אישית',
      Icon: FileText,
      Component: CustomSectionPanel,
    };
  }).filter(Boolean);

  return [STRUCTURE_PANEL, ...sectionPanels, STYLE_PANEL];
}

function SectionNavigation({ activePanel, openPanel, config, panels, className = '' }) {
  return (
    <nav className={className} aria-label="אזורי עריכת האתר">
      {panels.map((item) => {
        const section = getSiteSection(config, item.id);
        const hidden = Boolean(section && !section.enabled);
        const { Icon } = item;

        return (
          <button
            key={item.id}
            type="button"
            className={[
              'editor-section-nav-button',
              activePanel === item.id ? 'is-active' : '',
              hidden ? 'is-hidden-section' : '',
            ].filter(Boolean).join(' ')}
            aria-current={activePanel === item.id ? 'page' : undefined}
            aria-label={`עריכת ${item.label}${hidden ? ', האזור מוסתר' : ''}`}
            title={`עריכת ${item.label}${hidden ? ' · מוסתר באתר' : ''}`}
            onClick={() => openPanel(item.id)}
          >
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label}</span>
            {hidden && <EyeOff className="editor-section-nav-hidden-icon" size={13} aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );
}

function SectionVisibility({ panelId, config, replaceConfig, scrollToSection }) {
  const section = getSiteSection(config, panelId);
  if (!section) return null;
  const visible = section.enabled;

  const handleToggle = () => {
    const nextVisible = !visible;
    replaceConfig(current => setSiteSectionEnabled(current, panelId, nextVisible));
    if (nextVisible) {
      window.requestAnimationFrame(() => {
        scrollToSection(panelId);
        if (isCustomSectionId(panelId)) scrollSiteSectionIntoView(panelId);
      });
    }
  };

  return (
    <div className="editor-section-visibility">
      <div className="editor-section-visibility-copy">
        {visible ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}
        <span>
          <strong>{visible ? 'מוצג באתר' : 'מוסתר מהאתר'}</strong>
          <small>{visible ? 'הלקוחות יכולים לראות את האזור' : 'התוכן נשמר וניתן להציג אותו שוב'}</small>
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        className={`editor-visibility-switch ${visible ? 'is-on' : ''}`}
        onClick={handleToggle}
      >
        <span aria-hidden="true" />
        <span className="sr-only">{visible ? 'הסתרת האזור' : 'הצגת האזור'}</span>
      </button>
    </div>
  );
}

export default function EditorDrawer() {
  const {
    config,
    isEditing,
    activePanel,
    openPanel,
    closePanel,
    replaceConfig,
    scrollToSection,
    saveStatus = 'saved',
  } = useEditor();
  const panels = useMemo(() => getPanels(config), [config]);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(null);
  const [sheetDragging, setSheetDragging] = useState(false);
  const headingRef = useRef(null);
  const inspectorRef = useRef(null);
  const inspectorContentRef = useRef(null);
  const returnFocusRef = useRef(null);
  const dragRef = useRef(null);
  const panelScrollPositionsRef = useRef(new Map());

  const panel = panels.find((item) => item.id === activePanel);
  const PanelComponent = panel?.Component;
  const open = Boolean(isEditing && panel);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activePanel, open]);

  useLayoutEffect(() => {
    const content = inspectorContentRef.current;
    if (!open || !activePanel || !content) return undefined;

    const savedPosition = panelScrollPositionsRef.current.get(activePanel) || 0;
    content.scrollTop = savedPosition;

    return undefined;
  }, [activePanel, open]);

  useEffect(() => {
    if (!isEditing) {
      setSheetExpanded(false);
      setSheetHeight(null);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!open || !window.matchMedia(MOBILE_QUERY).matches) return undefined;

    const syncToViewport = () => {
      const metrics = getSheetMetrics();
      setSheetHeight(current => {
        if (sheetExpanded) return metrics.max;
        if (!Number.isFinite(current)) return metrics.partial;
        return clamp(current, metrics.min, metrics.max);
      });
    };

    syncToViewport();
    window.addEventListener('resize', syncToViewport);
    window.visualViewport?.addEventListener('resize', syncToViewport);
    window.visualViewport?.addEventListener('scroll', syncToViewport);
    return () => {
      window.removeEventListener('resize', syncToViewport);
      window.visualViewport?.removeEventListener('resize', syncToViewport);
      window.visualViewport?.removeEventListener('scroll', syncToViewport);
    };
  }, [open, sheetExpanded]);

  const setPartialSheet = () => {
    const { partial } = getSheetMetrics();
    setSheetHeight(partial);
    setSheetExpanded(false);
  };

  const setFullSheet = () => {
    const { max } = getSheetMetrics();
    setSheetHeight(max);
    setSheetExpanded(true);
  };

  const toggleSheetSize = () => {
    if (sheetExpanded) setPartialSheet();
    else setFullSheet();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (window.matchMedia(MOBILE_QUERY).matches) {
        const { partial } = getSheetMetrics();
        if (sheetExpanded || (sheetHeight || 0) > partial + 12) {
          setPartialSheet();
          return;
        }
      }
      closePanel();
      window.requestAnimationFrame(() => returnFocusRef.current?.focus?.());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePanel, open, sheetExpanded, sheetHeight]);

  const handleClose = () => {
    closePanel();
    setPartialSheet();
    window.requestAnimationFrame(() => returnFocusRef.current?.focus?.());
  };

  const handleSheetPointerDown = (event) => {
    if (!window.matchMedia(MOBILE_QUERY).matches || event.button > 0) return;
    const metrics = getSheetMetrics();
    const currentHeight = inspectorRef.current?.getBoundingClientRect().height || sheetHeight || metrics.partial;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: currentHeight,
      currentHeight,
      metrics,
      handle: event.currentTarget,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSheetDragging(true);
    setSheetExpanded(false);
    event.preventDefault();
  };

  const handleSheetPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextHeight = clamp(
      drag.startHeight + drag.startY - event.clientY,
      drag.metrics.min,
      drag.metrics.max,
    );
    drag.currentHeight = nextHeight;
    setSheetHeight(nextHeight);
    event.preventDefault();
  };

  const finishSheetDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = drag.currentHeight;
    const { partial, max, min } = drag.metrics;
    let next = clamp(current, min, max);

    if (Math.abs(next - partial) <= 54 || next < partial) next = partial;
    else if (Math.abs(max - next) <= 74) next = max;
    else next = Math.round(next / 4) * 4;

    setSheetHeight(next);
    setSheetExpanded(Math.abs(next - max) < 2);
    setSheetDragging(false);
    dragRef.current = null;
    drag.handle?.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  useEffect(() => {
    if (!sheetDragging) return undefined;

    const handleWindowPointerMove = (event) => {
      handleSheetPointerMove(event);
    };
    const handleWindowPointerEnd = (event) => {
      finishSheetDrag(event);
    };

    // Pointer capture is not equally reliable in DevTools device emulation and
    // embedded browsers. Tracking on window keeps the drag continuous even
    // after the pointer leaves the small visual handle.
    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerEnd, { passive: false });
    window.addEventListener('pointercancel', handleWindowPointerEnd, { passive: false });

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
    };
  }, [sheetDragging]);

  const handleSheetKeyDown = (event) => {
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSheetSize();
      return;
    }
    const metrics = getSheetMetrics();
    const current = sheetHeight || metrics.partial;
    let next = null;

    if (event.key === 'ArrowUp') next = clamp(current + 40, metrics.min, metrics.max);
    if (event.key === 'ArrowDown') next = clamp(current - 40, metrics.min, metrics.max);
    if (event.key === 'Home') next = metrics.partial;
    if (event.key === 'End') next = metrics.max;
    if (next === null) return;

    event.preventDefault();
    setSheetHeight(next);
    setSheetExpanded(next === metrics.max);
  };

  if (!isEditing) return null;

  const sheetMetrics = getSheetMetrics();
  const accessibleSheetHeight = Math.round(sheetHeight || sheetMetrics.partial);

  return (
    <aside
      className={[
        'editor-studio-shell',
        open ? 'is-open' : 'is-collapsed',
        sheetExpanded ? 'is-sheet-expanded' : '',
        sheetDragging ? 'is-sheet-dragging' : '',
      ].filter(Boolean).join(' ')}
      aria-label="סטודיו SweetlightSelfie לעריכת האתר"
      dir="rtl"
      style={sheetHeight ? { '--editor-sheet-height': `${sheetHeight}px` } : undefined}
    >
      {open && (
        <section ref={inspectorRef} className="editor-inspector" aria-labelledby="editor-inspector-title">
          <header className="editor-inspector-header">
            <button
              type="button"
              className="editor-mobile-sheet-handle"
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={finishSheetDrag}
              onPointerCancel={finishSheetDrag}
              onKeyDown={handleSheetKeyDown}
              onDoubleClick={toggleSheetSize}
              role="slider"
              aria-valuemin={Math.round(sheetMetrics.min)}
              aria-valuemax={Math.round(sheetMetrics.max)}
              aria-valuenow={accessibleSheetHeight}
              aria-label="גובה חלון העריכה. גררו מעלה או מטה, או השתמשו בחיצים"
              title="גרירה לשינוי גובה חלון העריכה"
            >
              <span aria-hidden="true" />
            </button>
            <div className="editor-inspector-heading-row">
              <div className="editor-inspector-heading-copy">
                <span className="editor-inspector-eyebrow" dir="ltr">
                  <SweetLightLogo size={20} />
                  SweetLight Selfie
                </span>
                <h2 id="editor-inspector-title" ref={headingRef} tabIndex="-1">{panel.label}</h2>
                <p>{panel.description}</p>
              </div>

              <div className="editor-inspector-header-actions">
                <button
                  type="button"
                  className="editor-sheet-size-button"
                  onClick={toggleSheetSize}
                  aria-label={sheetExpanded ? 'הקטנת חלון העריכה' : 'הרחבת חלון העריכה'}
                  aria-pressed={sheetExpanded}
                  title={sheetExpanded ? 'הקטנה' : 'הרחבה'}
                >
                  {sheetExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button type="button" className="editor-inspector-close" onClick={handleClose} aria-label="כיווץ אזור העריכה" title="כיווץ">
                  <PanelRightClose size={19} />
                </button>
              </div>
            </div>

            <SectionNavigation activePanel={activePanel} openPanel={openPanel} config={config} panels={panels} className="editor-mobile-section-strip" />
            <div className="editor-mobile-save-state" aria-live="polite">
              <span className={saveStatus === 'saving' ? 'is-saving' : ''} />
              {saveStatus === 'saving' ? 'שומר…' : 'כל השינויים נשמרו'}
            </div>
          </header>

          <div
            ref={inspectorContentRef}
            className="editor-inspector-content"
            data-editor-panel={activePanel}
            onScroll={(event) => {
              if (activePanel) {
                panelScrollPositionsRef.current.set(activePanel, event.currentTarget.scrollTop);
              }
            }}
          >
            <SectionVisibility
              panelId={activePanel}
              config={config}
              replaceConfig={replaceConfig}
              scrollToSection={scrollToSection}
            />
            {PanelComponent && <PanelComponent key={activePanel} sectionId={activePanel} />}
          </div>
        </section>
      )}

      <SectionNavigation activePanel={activePanel} openPanel={openPanel} config={config} panels={panels} className="editor-section-rail" />
    </aside>
  );
}
