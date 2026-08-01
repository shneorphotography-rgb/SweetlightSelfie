import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send } from 'lucide-react';
import { useEditor } from './EditorContext';
import ShareCenter, { DEFAULT_CLIENT_SHARE_MESSAGE } from './share/ShareCenter';
import './structure-share-sheet.css';

export { DEFAULT_CLIENT_SHARE_MESSAGE };

export default function ClientShare({
  pillStyle,
  buttonClassName = '',
  showLabel = true,
}) {
  const { config, replaceConfig } = useEditor();
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef(null);
  const returnFocusRef = useRef(null);
  const layerRef = useRef(null);

  const openShare = event => {
    returnFocusRef.current = event.currentTarget;
    setIsOpen(true);
  };

  const closeShare = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus?.());
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const visualViewport = window.visualViewport;
    let focusVisibilityTimer = 0;
    const ensureFocusedControlVisible = field => {
      if (!window.matchMedia('(max-width: 860px)').matches) return;
      if (!field?.matches?.('input, textarea, select')) return;
      const scrollContainer = field.closest?.('.share-center-scroll');
      if (!scrollContainer) return;
      const fieldRect = field.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const actionBar = layerRef.current?.querySelector('.share-sticky-actions');
      const actionBarHeight = actionBar?.getBoundingClientRect().height || 0;
      const visibleTop = containerRect.top + 18;
      const visibleBottom = containerRect.bottom - actionBarHeight - 18;
      if (fieldRect.top < visibleTop || fieldRect.bottom > visibleBottom) {
        const fieldCenter = fieldRect.top + (fieldRect.height / 2);
        const visibleCenter = visibleTop + ((visibleBottom - visibleTop) / 2);
        scrollContainer.scrollBy({ top: fieldCenter - visibleCenter, behavior: 'smooth' });
      }
    };
    const scheduleFocusedControlCheck = (field = document.activeElement, delay = 140) => {
      window.clearTimeout(focusVisibilityTimer);
      focusVisibilityTimer = window.setTimeout(() => ensureFocusedControlVisible(field), delay);
    };
    const syncVisualViewport = () => {
      const layer = layerRef.current;
      if (!layer) return;
      layer.style.setProperty('--share-visual-height', `${visualViewport?.height || window.innerHeight}px`);
      layer.style.setProperty('--share-visual-offset', `${visualViewport?.offsetTop || 0}px`);
      scheduleFocusedControlCheck(document.activeElement, 180);
    };
    const keepFocusedControlVisible = event => {
      scheduleFocusedControlCheck(event.target, 80);
    };
    syncVisualViewport();
    visualViewport?.addEventListener('resize', syncVisualViewport);
    visualViewport?.addEventListener('scroll', syncVisualViewport);
    layerRef.current?.addEventListener('focusin', keepFocusedControlVisible);
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        if (layerRef.current?.querySelector('.share-confirm-dialog')) return;
        closeShare();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(layerRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [])].filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !layerRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.clearTimeout(focusVisibilityTimer);
      visualViewport?.removeEventListener('resize', syncVisualViewport);
      visualViewport?.removeEventListener('scroll', syncVisualViewport);
      layerRef.current?.removeEventListener('focusin', keepFocusedControlVisible);
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className={`editor-control-pill editor-control-pill--compact-mobile ${buttonClassName}`.trim()}
        onClick={openShare}
        aria-label="שליחה ללקוח"
        title="שליחה ללקוח"
        style={pillStyle}
      >
        <Send size={16} strokeWidth={1.9} />
        {showLabel && <span className="editor-pill-label">שליחה ללקוח</span>}
      </button>

      {isOpen && createPortal(
        <div
          ref={layerRef}
          className="share-center-layer"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeShare();
          }}
        >
          <ShareCenter
            config={config}
            replaceConfig={replaceConfig}
            onClose={closeShare}
            closeButtonRef={closeButtonRef}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
