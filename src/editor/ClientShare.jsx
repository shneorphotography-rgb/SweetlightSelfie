import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  ExternalLink,
  Link as LinkIcon,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { resolveClientViewUrl } from '../utils/clientView';
import { useEditor } from './EditorContext';
import SweetLightLogo from './SweetLightLogo';
import './structure-share-sheet.css';

export const DEFAULT_CLIENT_SHARE_MESSAGE = 'היי, אשמח לעמוד לשירותכם באירוע שלכם. מצרף את האתר הרשמי שלי, שבו תוכלו להתרשם מהעבודות, מחבילות הצילום ומהשירותים שאני מציע:';

const MESSAGE_MODES = [
  { id: 'default', label: 'הודעה מומלצת', Icon: Sparkles },
  { id: 'custom', label: 'הודעה אישית', Icon: MessageCircle },
  { id: 'link-only', label: 'רק קישור', Icon: LinkIcon },
];

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) throw new Error('Copy failed');
}

function normalizeMessageMode(mode) {
  return MESSAGE_MODES.some(option => option.id === mode) ? mode : 'default';
}

function buildWhatsAppMessage(mode, customMessage, shareUrl) {
  if (!shareUrl) return '';
  if (mode === 'link-only') return shareUrl;
  const message = mode === 'custom' ? customMessage.trim() : DEFAULT_CLIENT_SHARE_MESSAGE;
  return message ? `${message}\n\n${shareUrl}` : shareUrl;
}

export default function ClientShare({
  pillStyle,
  buttonClassName = '',
  showLabel = true,
}) {
  const {
    config,
    updateConfig,
    replaceConfig,
    saveStatus = 'saved',
  } = useEditor();
  const [isOpen, setIsOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [status, setStatus] = useState('');
  const snapshotConfigRef = useRef(config);
  const closeButtonRef = useRef(null);
  const returnFocusRef = useRef(null);

  const messageSettings = config?.sharing?.clientMessage || {};
  const messageMode = normalizeMessageMode(messageSettings.mode);
  const customMessage = messageSettings.customMessage || '';

  const openShare = (event) => {
    snapshotConfigRef.current = config;
    returnFocusRef.current = event.currentTarget;
    setIsOpen(true);
  };

  const closeShare = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus?.());
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    let isCurrent = true;
    setShareUrl('');
    setStatus('');
    resolveClientViewUrl(snapshotConfigRef.current)
      .then(url => {
        if (isCurrent) setShareUrl(url);
      })
      .catch(() => {
        if (isCurrent) setStatus('לא הצלחנו להכין את הקישור. ודאו שהשרת פועל ונסו שוב.');
      });

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = event => {
      if (event.key === 'Escape') closeShare();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isCurrent = false;
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const whatsappMessage = useMemo(
    () => buildWhatsAppMessage(messageMode, customMessage, shareUrl),
    [customMessage, messageMode, shareUrl],
  );

  const whatsappHref = useMemo(() => (
    whatsappMessage ? `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}` : '#'
  ), [whatsappMessage]);

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      await copyText(shareUrl);
      setStatus('הקישור הועתק ✓');
    } catch {
      setStatus('לא הצלחנו להעתיק אוטומטית — אפשר לסמן את הקישור ולהעתיק.');
    }
  };

  const resetMessage = () => {
    replaceConfig(current => ({
      ...current,
      sharing: {
        ...(current.sharing || {}),
        clientMessage: {
          mode: 'default',
          customMessage: '',
        },
      },
    }));
  };

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
          role="presentation"
          className="client-share-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeShare();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-share-title"
            className="client-share-dialog client-share-dialog--with-message"
            dir="rtl"
          >
            <div className="client-share-header">
              <div className="client-share-heading">
                <span className="client-share-mark">
                  <SweetLightLogo size={42} title="SweetLight" />
                </span>
                <div>
                  <span className="client-share-kicker" dir="ltr">SweetlightSelfie</span>
                  <h2 id="client-share-title">שיתוף האתר עם הלקוח</h2>
                  <p>הקישור פותח תצוגה נקייה, בלי כפתורי עריכה או כלי ניהול.</p>
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeShare}
                aria-label="סגירת חלון השיתוף"
                className="client-share-close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="client-share-message-editor">
              <div className="client-share-message-heading">
                <div>
                  <strong>מה יצורף ב־WhatsApp?</strong>
                  <small>הקישור מצורף אוטומטית בסוף ההודעה.</small>
                </div>
                <span className={saveStatus === 'saving' ? 'is-saving' : ''} aria-live="polite">
                  {saveStatus === 'saving' ? 'שומר…' : 'נשמר'}
                </span>
              </div>

              <div className="client-share-message-modes" role="radiogroup" aria-label="סוג ההודעה ללקוח">
                {MESSAGE_MODES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={messageMode === id}
                    className={messageMode === id ? 'is-active' : ''}
                    onClick={() => updateConfig('sharing.clientMessage.mode', id)}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>

              {messageMode === 'default' && (
                <div className="client-share-default-message">
                  <p>{DEFAULT_CLIENT_SHARE_MESSAGE}</p>
                  <span>הקישור שלכם</span>
                </div>
              )}

              {messageMode === 'custom' && (
                <label className="client-share-custom-message">
                  <span>ההודעה האישית שלכם</span>
                  <textarea
                    rows="5"
                    maxLength="600"
                    value={customMessage}
                    onChange={(event) => updateConfig('sharing.clientMessage.customMessage', event.target.value)}
                    placeholder="כתבו הודעה אישית…"
                  />
                  <small>{customMessage.length}/600 · הקישור יופיע בשורה נפרדת</small>
                </label>
              )}

              {messageMode === 'link-only' && (
                <p className="client-share-link-only-note">תיפתח הודעת WhatsApp חדשה ובה הקישור בלבד.</p>
              )}

              {(messageMode !== 'default' || customMessage) && (
                <button type="button" className="client-share-reset-message" onClick={resetMessage}>
                  <RotateCcw size={14} />
                  חזרה להודעה המומלצת
                </button>
              )}
            </div>

            <label htmlFor="client-share-url" className="client-share-label">קישור ללקוח</label>
            <input
              id="client-share-url"
              value={shareUrl || 'מכין קישור…'}
              readOnly
              onFocus={event => shareUrl && event.currentTarget.select()}
              dir="ltr"
              className="client-share-input"
              data-loading={!shareUrl ? 'true' : undefined}
            />

            <div className="client-share-actions">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!shareUrl}
                className="client-share-action client-share-copy"
              >
                <Copy size={17} />
                העתקת קישור
              </button>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!shareUrl}
                onClick={event => {
                  if (!shareUrl) event.preventDefault();
                }}
                className={`client-share-action client-share-whatsapp ${!shareUrl ? 'is-disabled' : ''}`}
              >
                <MessageCircle size={18} />
                שליחה ב־WhatsApp
              </a>
            </div>

            {shareUrl && (
              <a href={shareUrl} target="_blank" rel="noreferrer" className="client-share-preview-link">
                פתיחת תצוגת הלקוח לבדיקה
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}

            <div aria-live="polite" className="client-share-status">{status}</div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
