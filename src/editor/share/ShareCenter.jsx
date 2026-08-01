import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ClipboardCopy,
  Copy,
  ExternalLink,
  FilePenLine,
  History,
  Link as LinkIcon,
  LockKeyhole,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import SweetLightLogo from '../SweetLightLogo';
import { resolvePersonalizedPricing } from '../../sharing/pricing';
import {
  archiveShareRecord,
  createShareRecord,
  createShareVersion,
  duplicateShareRecord,
  getGeneralClientUrl,
  getShareRecord,
  getShareStorageMode,
  listShareRecords,
  restoreShareRecord,
  revokeShareRecord,
} from '../../sharing/shareRepository';
import {
  getShareAuthSession,
  isShareAuthConfigured,
  signInShareUser,
  signOutShareUser,
} from '../../sharing/shareAuth';
import './share-center.css';

export const DEFAULT_CLIENT_SHARE_MESSAGE = 'היי, אשמח לעמוד לשירותכם באירוע שלכם. מצרף את האתר הרשמי שלי, שבו תוכלו להתרשם מהעבודות, מחבילות הצילום ומהשירותים שאני מציע:';

const EMPTY_CLIENT = {
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  eventType: '',
  eventDate: '',
  venue: '',
  internalNotes: '',
  expiresAt: '',
};

const STATUS_LABELS = {
  active: 'פעיל',
  draft: 'טיוטה',
  revoked: 'בוטל',
  expired: 'פג תוקף',
  archived: 'בארכיון',
};

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) return Promise.reject(new Error('Copy failed'));
  return Promise.resolve();
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

function buildMessage(message, includeText, url) {
  if (!url) return '';
  const text = String(message || '').trim();
  return includeText && text ? `${text}\n\n${url}` : url;
}

function getWhatsAppHref({ message, includeText, url, phone }) {
  const recipient = normalizePhone(phone);
  const payload = encodeURIComponent(buildMessage(message, includeText, url));
  return `https://wa.me/${recipient}?text=${payload}`;
}

function formatDate(value, options = {}) {
  if (!value) return 'ללא תאריך';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(date);
}

function formatCreatedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getPricing(config) {
  const pricing = config?.sections?.pricing || {};
  const packages = Array.isArray(pricing.packages)
    ? pricing.packages
    : pricing.package
      ? [pricing.package]
      : [];
  const addons = Array.isArray(pricing.addons)
    ? pricing.addons
    : Array.isArray(pricing.services)
      ? pricing.services
      : [];
  return { pricing, packages, addons };
}

function createPricingDraft(config) {
  const { packages, addons } = getPricing(config);
  const toDraft = items => Object.fromEntries(items.map(item => [item.id, {
    visible: true,
    price: item.price || '',
    currency: item.currency || '₪',
    priceNote: item.priceNote || '',
    status: 'priced',
    showOriginalPrice: false,
  }]));
  return { packages: toDraft(packages), addons: toDraft(addons) };
}

function getMessageSettings(config) {
  const settings = config?.sharing?.clientMessage || {};
  if (typeof settings.text === 'string') {
    return {
      text: settings.text || DEFAULT_CLIENT_SHARE_MESSAGE,
      includeText: settings.includeText !== false,
    };
  }
  if (settings.mode === 'link-only') {
    return { text: settings.customMessage || DEFAULT_CLIENT_SHARE_MESSAGE, includeText: false };
  }
  if (settings.mode === 'custom') {
    return { text: settings.customMessage || DEFAULT_CLIENT_SHARE_MESSAGE, includeText: true };
  }
  return { text: DEFAULT_CLIENT_SHARE_MESSAGE, includeText: true };
}

function pricingSummary(record) {
  const snapshot = record?.currentSnapshot || record?.versions?.at?.(-1) || {};
  const resolved = snapshot.resolvedPricing || record?.resolvedPricing || {};
  const items = (Array.isArray(resolved)
    ? resolved
    : [...(resolved.packages || []), ...(resolved.addons || [])])
    .filter(item => item.visible !== false)
    .slice(0, 2);
  if (!items.length) return 'ללא תקציר מחיר';
  return items.map(item => `${item.title}: ${item.displayPrice || item.quotedPrice || item.price || '—'}`).join(' · ');
}

function ConfirmDialog({ confirmation, onClose }) {
  const dialogRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!confirmation) return undefined;
    setError('');
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector('button')?.focus();
    });
    const handleEscape = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [confirmation]);

  if (!confirmation) return null;
  return (
    <div className="share-confirm-layer" role="presentation">
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="share-confirm-title" className="share-confirm-dialog">
        <span className="share-confirm-icon"><RefreshCw size={19} /></span>
        <h3 id="share-confirm-title">{confirmation.title}</h3>
        <p>{confirmation.body}</p>
        {error && <div className="share-confirm-error" role="alert">{error}</div>}
        <div className="share-confirm-actions">
          <button type="button" className="share-button share-button--quiet" onClick={onClose}>ביטול</button>
          <button
            type="button"
            className={`share-button ${confirmation.danger ? 'share-button--danger' : 'share-button--primary'}`}
            onClick={async () => {
              try {
                await confirmation.onConfirm();
                onClose();
              } catch (nextError) {
                setError(nextError.message || 'הפעולה נכשלה. אפשר לנסות שוב.');
              }
            }}
          >
            {confirmation.confirmLabel || 'אישור'}
          </button>
        </div>
      </section>
    </div>
  );
}

function ShareStatusBadge({ status }) {
  return <span className={`share-status-badge is-${status || 'active'}`}>{STATUS_LABELS[status] || status}</span>;
}

function ActionButton({ children, Icon, variant = 'quiet', ...props }) {
  return (
    <button type="button" className={`share-button share-button--${variant}`} {...props}>
      {Icon && <Icon size={17} aria-hidden="true" />}
      {children}
    </button>
  );
}

function ShareLogin({ configured, isChecking, onSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onSignIn(email, password);
      setPassword('');
    } catch (nextError) {
      setError(nextError.message || 'ההתחברות נכשלה.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="share-login-view">
      <span className="share-login-icon"><LockKeyhole size={24} /></span>
      <p>אזור פרטי לצלם</p>
      <h2>{isChecking ? 'בודקים את ההתחברות…' : 'כניסה למרכז השיתוף'}</h2>
      <span>פרטי לקוחות, מחירים וקישורים זמינים רק לבעל החשבון.</span>
      {!isChecking && !configured && (
        <div className="share-login-setup" role="status">
          חסרות הגדרות Supabase Auth. יש להוסיף את כתובת הפרויקט והמפתח הציבורי לפני חיבור הפרסום.
        </div>
      )}
      {!isChecking && configured && (
        <form onSubmit={submit}>
          <label className="share-field">
            <span>אימייל</span>
            <input type="email" dir="ltr" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required autoFocus />
          </label>
          <label className="share-field">
            <span>סיסמה</span>
            <input type="password" dir="ltr" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
          </label>
          {error && <div className="share-login-error" role="alert">{error}</div>}
          <button type="submit" className="share-button share-button--primary" disabled={isSubmitting}>
            {isSubmitting ? <RefreshCw className="is-spinning" size={17} /> : <LogIn size={17} />}
            {isSubmitting ? 'מתחברים…' : 'כניסה מאובטחת'}
          </button>
        </form>
      )}
    </div>
  );
}

function GeneralLinkCard({
  url,
  message,
  includeText,
  onCopy,
  onStatus,
  published,
  publishedAt,
  canPublish,
  isPublishing,
  onPublish,
}) {
  const whatsappHref = getWhatsAppHref({ message, includeText, url });
  const handleNativeShare = async () => {
    if (!published) {
      onStatus('יש לפרסם את הקישור הכללי לפני השיתוף.');
      return;
    }
    if (!navigator.share) {
      await onCopy(url, 'הקישור הועתק');
      return;
    }
    try {
      await navigator.share({ title: 'האתר שלי', text: includeText ? message : '', url });
    } catch (error) {
      if (error.name !== 'AbortError') onStatus('לא הצלחנו לפתוח את השיתוף במכשיר.');
    }
  };

  return (
    <section className="share-general-card" aria-labelledby="general-link-title">
      <div className="share-card-heading">
        <span className="share-card-icon"><LinkIcon size={19} /></span>
        <div>
          <p>הקישור הקבוע</p>
          <h3 id="general-link-title">האתר הציבורי</h3>
          <span>מציג את התוכן והמחירים הרגילים.</span>
        </div>
        <span className={`share-live-badge ${published ? '' : 'is-draft'}`}><i /> {published ? 'פורסם' : 'טרם פורסם'}</span>
      </div>

      <div className="share-link-field">
        <input
          value={published ? url : 'הקישור יופיע כאן לאחר הפרסום'}
          readOnly
          dir={published ? 'ltr' : 'rtl'}
          aria-label="הקישור הכללי לאתר"
          aria-disabled={!published}
          onFocus={event => { if (published) event.currentTarget.select(); }}
        />
        <button type="button" disabled={!published} onClick={() => onCopy(url, 'הקישור הכללי הועתק')} aria-label="העתקת הקישור הכללי">
          <Copy size={17} />
        </button>
      </div>

      <div className="share-general-publish">
        <div>
          <strong>{published ? 'אותו קישור, עם הגרסה האחרונה' : 'פרסום ראשון ייצור קישור כללי קבוע'}</strong>
          <span>{publishedAt ? `עודכן ${formatCreatedAt(publishedAt)}` : 'הפרסום אינו משנה הצעות אישיות קיימות.'}</span>
        </div>
        <button type="button" className="share-button share-button--primary" disabled={!canPublish || isPublishing} onClick={onPublish}>
          {isPublishing ? <RefreshCw className="is-spinning" size={17} /> : <RefreshCw size={17} />}
          {isPublishing ? 'מפרסמים…' : (published ? 'עדכון האתר בקישור' : 'פרסום הקישור הכללי')}
        </button>
      </div>

      <div className="share-card-actions">
        {published ? (
          <>
            <a className="share-button share-button--whatsapp" href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> שליחה ב־WhatsApp
            </a>
            <a className="share-button share-button--quiet" href={url} target="_blank" rel="noreferrer">
              <ExternalLink size={17} /> תצוגת לקוח
            </a>
          </>
        ) : (
          <>
            <button type="button" className="share-button share-button--whatsapp" disabled><MessageCircle size={18} /> שליחה ב־WhatsApp</button>
            <button type="button" className="share-button share-button--quiet" disabled><ExternalLink size={17} /> תצוגת לקוח</button>
          </>
        )}
        <ActionButton Icon={Share2} disabled={!published} onClick={handleNativeShare}>שיתוף</ActionButton>
      </div>
    </section>
  );
}

function MessageEditor({ message, includeText, onMessageChange, onIncludeTextChange, onSaveDefault, onReset }) {
  return (
    <section className="share-message-editor" aria-labelledby="share-message-title">
      <div className="share-section-heading">
        <div>
          <p>הודעת השיתוף</p>
          <h3 id="share-message-title">הטקסט שיצורף ב־WhatsApp</h3>
        </div>
        <Sparkles size={19} aria-hidden="true" />
      </div>
      <label className={`share-textarea-field ${!includeText ? 'is-disabled' : ''}`}>
        <span className="sr-only">הודעת WhatsApp</span>
        <textarea
          rows="5"
          maxLength="600"
          value={message}
          disabled={!includeText}
          onChange={event => onMessageChange(event.target.value)}
        />
        <small>{message.length}/600 · הקישור מצורף אוטומטית בשורה חדשה</small>
      </label>

      <label className="share-check-row">
        <input type="checkbox" checked={!includeText} onChange={event => onIncludeTextChange(!event.target.checked)} />
        <span>
          <strong>שליחת קישור בלבד</strong>
          <small>ההודעה נשארת שמורה ולא תימחק.</small>
        </span>
      </label>

      <div className="share-inline-actions">
        <ActionButton Icon={Check} onClick={onSaveDefault}>שמירה כברירת המחדל שלי</ActionButton>
        <ActionButton Icon={RotateCcw} onClick={onReset}>איפוס להודעה המומלצת</ActionButton>
      </div>
    </section>
  );
}

function RecentShares({ records, onOpenAll, onSelect }) {
  return (
    <section className="share-recents" aria-labelledby="recent-shares-title">
      <div className="share-list-heading">
        <div>
          <p>תיעוד מסודר</p>
          <h3 id="recent-shares-title">הצעות אחרונות</h3>
        </div>
        <button type="button" onClick={onOpenAll}>לכל הלקוחות <ChevronLeft size={16} /></button>
      </div>
      {!records.length ? (
        <div className="share-empty-state">
          <History size={22} />
          <strong>עדיין לא נוצרה הצעה אישית</strong>
          <span>הקישור הראשון שתיצרו יישמר כאן עם פרטי האירוע והמחירים.</span>
        </div>
      ) : (
        <div className="share-recent-list">
          {records.slice(0, 4).map(record => (
            <button key={record.id} type="button" className="share-recent-row" onClick={() => onSelect(record)}>
              <span className="share-avatar">{String(record.clientName || '?').trim().slice(0, 1)}</span>
              <span className="share-recent-copy">
                <strong>{record.clientName}</strong>
                <small>{record.eventType || 'אירוע'} · {formatDate(record.eventDate)}</small>
              </span>
              <ShareStatusBadge status={record.status} />
              <ChevronLeft size={17} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Stepper({ step }) {
  const steps = ['פרטי הלקוח', 'התאמת מחיר', 'הודעה ויצירה'];
  return (
    <ol className="share-stepper" aria-label="שלבי יצירת הצעה">
      {steps.map((label, index) => {
        const number = index + 1;
        return (
          <li key={label} className={number === step ? 'is-active' : number < step ? 'is-complete' : ''} aria-current={number === step ? 'step' : undefined}>
            <span>{number < step ? <Check size={14} /> : number}</span>
            <small>{label}</small>
          </li>
        );
      })}
    </ol>
  );
}

function ClientDetailsStep({ value, onChange }) {
  const setField = (key, next) => onChange(current => ({ ...current, [key]: next }));
  return (
    <div className="share-form-grid">
      <label className="share-field share-field--wide">
        <span>שם הלקוח או הזוג *</span>
        <div><UserRound size={17} /><input autoFocus value={value.clientName} onChange={event => setField('clientName', event.target.value)} placeholder="למשל נועה ויובל" /></div>
      </label>
      <label className="share-field">
        <span>טלפון</span>
        <input dir="ltr" value={value.clientPhone} onChange={event => setField('clientPhone', event.target.value)} placeholder="050-0000000" inputMode="tel" />
      </label>
      <label className="share-field">
        <span>אימייל</span>
        <input dir="ltr" value={value.clientEmail} onChange={event => setField('clientEmail', event.target.value)} placeholder="client@email.com" inputMode="email" />
      </label>
      <label className="share-field">
        <span>סוג האירוע</span>
        <input value={value.eventType} onChange={event => setField('eventType', event.target.value)} placeholder="חתונת ערב" />
      </label>
      <label className="share-field">
        <span>תאריך האירוע</span>
        <div><CalendarDays size={17} /><input type="date" value={value.eventDate} onChange={event => setField('eventDate', event.target.value)} /></div>
      </label>
      <label className="share-field share-field--wide">
        <span>מקום האירוע</span>
        <div><MapPin size={17} /><input value={value.venue} onChange={event => setField('venue', event.target.value)} placeholder="אולם, עיר או לוקיישן" /></div>
      </label>
      <label className="share-field share-field--wide">
        <span>הערה פנימית</span>
        <textarea rows="3" value={value.internalNotes} onChange={event => setField('internalNotes', event.target.value)} placeholder="מידע שרק אתם תראו" />
      </label>
      <label className="share-field">
        <span>תוקף ההצעה</span>
        <input type="date" value={value.expiresAt} onChange={event => setField('expiresAt', event.target.value)} />
      </label>
    </div>
  );
}

function PricingItemEditor({ item, draft, onChange }) {
  const update = patch => onChange({ ...draft, ...patch });
  const mode = draft?.status || 'priced';
  return (
    <article className={`share-price-row ${draft?.visible === false ? 'is-hidden' : ''}`}>
      <label className="share-item-visibility">
        <input
          type="checkbox"
          checked={draft?.visible !== false}
          onChange={event => update({ visible: event.target.checked })}
          aria-label={`${draft?.visible === false ? 'הצגת' : 'הסתרת'} ${item.title}`}
        />
        <span aria-hidden="true" />
      </label>
      <div className="share-price-copy">
        <strong>{item.title}</strong>
        <small>מחיר באתר: {item.price || 'ללא מחיר'} {item.currency || ''}</small>
      </div>
      <label className="share-compact-field">
        <span>תצוגה</span>
        <select value={mode} onChange={event => update({ status: event.target.value })} disabled={draft?.visible === false}>
          <option value="priced">מחיר</option>
          <option value="included">כלול</option>
          <option value="gift">מתנה</option>
        </select>
      </label>
      <label className="share-compact-field share-compact-field--price">
        <span>המחיר בהצעה</span>
        <div>
          <input
            value={draft?.price || ''}
            onChange={event => update({ price: event.target.value })}
            disabled={draft?.visible === false || mode !== 'priced'}
            inputMode="decimal"
            dir="ltr"
          />
          <b>{draft?.currency || item.currency || '₪'}</b>
        </div>
      </label>
      <label className="share-compact-field share-compact-field--note">
        <span>הערה למחיר</span>
        <input value={draft?.priceNote || ''} onChange={event => update({ priceNote: event.target.value })} disabled={draft?.visible === false} placeholder="כולל מע״מ" />
      </label>
      <label className="share-original-price-option">
        <input
          type="checkbox"
          checked={Boolean(draft?.showOriginalPrice)}
          onChange={event => update({ showOriginalPrice: event.target.checked })}
          disabled={draft?.visible === false || mode !== 'priced' || draft?.price === item.price}
        />
        הצגת המחיר המקורי ליד החדש
      </label>
    </article>
  );
}

function PricingStep({ config, value, onChange }) {
  const { pricing, packages, addons } = getPricing(config);
  const updateItem = (group, id, next) => onChange(current => ({
    ...current,
    [group]: { ...current[group], [id]: next },
  }));
  const reset = () => onChange(createPricingDraft(config));

  if (pricing.enabled === false || (!packages.length && !addons.length)) {
    return (
      <div className="share-empty-state share-empty-state--large">
        <FilePenLine size={25} />
        <strong>אין הצעת מחיר פעילה באתר</strong>
        <span>הקישור האישי יישמר עם פרטי הלקוח והאירוע, ללא שלב מחירים.</span>
      </div>
    );
  }

  return (
    <div className="share-pricing-editor">
      <div className="share-pricing-notice">
        <ShieldCheck size={19} />
        <div>
          <strong>השינויים חלים רק על הקישור הזה</strong>
          <span>המחירון באתר והצעות אחרות לא ישתנו.</span>
        </div>
        <button type="button" onClick={reset}><RotateCcw size={15} /> איפוס למחירי האתר</button>
      </div>
      {packages.length > 0 && (
        <section className="share-price-group">
          <div className="share-price-group-heading"><span>חבילות צילום</span><small>{packages.length} פריטים</small></div>
          {packages.map(item => (
            <PricingItemEditor key={item.id} item={item} draft={value.packages[item.id]} onChange={next => updateItem('packages', item.id, next)} />
          ))}
        </section>
      )}
      {addons.length > 0 && (
        <section className="share-price-group">
          <div className="share-price-group-heading"><span>שירותים נוספים</span><small>{addons.length} פריטים</small></div>
          {addons.map(item => (
            <PricingItemEditor key={item.id} item={item} draft={value.addons[item.id]} onChange={next => updateItem('addons', item.id, next)} />
          ))}
        </section>
      )}
    </div>
  );
}

function MessagePreview({ message, includeText, clientName }) {
  return (
    <div className="share-message-preview" aria-label="תצוגה מקדימה של הודעת WhatsApp">
      <div className="share-message-preview-top"><MessageCircle size={17} /><span>תצוגה מקדימה</span></div>
      <div className="share-message-bubble">
        {includeText && <p>{message}</p>}
        <span dir="ltr">https://…/SweetlightSelfie/?view=client&amp;share=••••••</span>
      </div>
      <small>{clientName ? `ההצעה תישמר עבור ${clientName}` : 'יש להזין שם לקוח לפני יצירת הקישור'}</small>
    </div>
  );
}

function CreateOfferView({ config, message, includeText, onMessageChange, onIncludeTextChange, onSaveDefault, onResetMessage, onBack, onCreated, onStatus }) {
  const [step, setStep] = useState(1);
  const [client, setClient] = useState(EMPTY_CLIENT);
  const [pricingDraft, setPricingDraft] = useState(() => createPricingDraft(config));
  const [isCreating, setIsCreating] = useState(false);
  const formTopRef = useRef(null);

  const goToStep = next => {
    setStep(next);
    window.requestAnimationFrame(() => {
      const scrollContainer = formTopRef.current?.closest?.('.share-center-scroll');
      scrollContainer?.scrollTo?.({ top: 0, behavior: 'smooth' });
    });
  };

  const handleCreate = async () => {
    if (!client.clientName.trim()) {
      onStatus('כדי ליצור הצעה צריך להוסיף שם לקוח.');
      goToStep(1);
      return;
    }
    setIsCreating(true);
    try {
      const { resolvedConfig, resolvedPricing } = resolvePersonalizedPricing(config, pricingDraft);
      const share = await createShareRecord({
        ...client,
        label: `${client.clientName.trim()}${client.eventDate ? ` — ${formatDate(client.eventDate)}` : ''}`,
        expiresAt: client.expiresAt ? new Date(`${client.expiresAt}T23:59:59`).toISOString() : null,
        pricingOverrides: pricingDraft,
        resolvedPricing,
        resolvedConfig,
        messageSnapshot: { includeText, text: message },
      });
      onCreated(share);
    } catch (error) {
      onStatus(error.message || 'לא הצלחנו ליצור את הקישור.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="share-create-view" ref={formTopRef}>
      <button type="button" className="share-back-button" onClick={onBack}><ArrowRight size={17} /> חזרה למרכז השיתוף</button>
      <div className="share-view-heading">
        <div>
          <p>הצעה אישית</p>
          <h2>יצירת קישור מותאם ללקוח</h2>
          <span>המחירים והשינויים יישמרו רק ברשומה הזו.</span>
        </div>
        <span className="share-heading-mark"><FilePenLine size={22} /></span>
      </div>
      <Stepper step={step} />
      <section className="share-step-content">
        {step === 1 && <ClientDetailsStep value={client} onChange={setClient} />}
        {step === 2 && <PricingStep config={config} value={pricingDraft} onChange={setPricingDraft} />}
        {step === 3 && (
          <div className="share-final-step">
            <MessageEditor
              message={message}
              includeText={includeText}
              onMessageChange={onMessageChange}
              onIncludeTextChange={onIncludeTextChange}
              onSaveDefault={onSaveDefault}
              onReset={onResetMessage}
            />
            <MessagePreview message={message} includeText={includeText} clientName={client.clientName} />
          </div>
        )}
      </section>
      <footer className="share-sticky-actions">
        {step > 1 ? <ActionButton Icon={ArrowRight} onClick={() => goToStep(step - 1)}>השלב הקודם</ActionButton> : <span />}
        {step < 3 ? (
          <ActionButton
            Icon={ArrowLeft}
            variant="primary"
            onClick={() => {
              if (step === 1 && !client.clientName.trim()) {
                onStatus('כדי להמשיך צריך להוסיף שם לקוח.');
                return;
              }
              goToStep(step + 1);
            }}
          >
            המשך
          </ActionButton>
        ) : (
          <ActionButton Icon={LinkIcon} variant="primary" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'יוצר ושומר…' : 'יצירת הקישור ושמירת ההצעה'}
          </ActionButton>
        )}
      </footer>
    </div>
  );
}

function ShareSuccess({ share, message, includeText, onCopy, onOpenRecord, onNew }) {
  const whatsappHref = getWhatsAppHref({
    message,
    includeText,
    url: share.publicUrl,
    phone: share.clientPhone,
  });
  return (
    <div className="share-success-view">
      <span className="share-success-icon"><Check size={28} /></span>
      <p>הקישור נשמר במרכז השיתוף</p>
      <h2>ההצעה של {share.clientName} מוכנה</h2>
      <span>{share.eventType || 'אירוע'}{share.eventDate ? ` · ${formatDate(share.eventDate)}` : ''}</span>
      <div className="share-success-summary">
        <strong>{pricingSummary(share)}</strong>
        <div className="share-link-field">
          <input value={share.publicUrl || ''} readOnly dir="ltr" onFocus={event => event.currentTarget.select()} />
          <button type="button" onClick={() => onCopy(share.publicUrl, 'הקישור האישי הועתק')}><Copy size={17} /></button>
        </div>
      </div>
      <div className="share-success-actions">
        <a className="share-button share-button--whatsapp" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={18} /> פתיחה ב־WhatsApp</a>
        <a className="share-button share-button--quiet" href={share.publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} /> בדיקת הקישור</a>
        <ActionButton Icon={ClipboardCopy} onClick={() => onCopy(buildMessage(message, includeText, share.publicUrl), 'ההודעה והקישור הועתקו')}>העתקת הכול</ActionButton>
      </div>
      <div className="share-inline-actions share-inline-actions--center">
        <ActionButton Icon={History} onClick={onOpenRecord}>מעבר לרשומת הלקוח</ActionButton>
        <ActionButton Icon={Plus} onClick={onNew}>הצעה נוספת</ActionButton>
      </div>
    </div>
  );
}

function HistoryList({ records, query, status, sort, onQuery, onStatus, onSort, onSelect, onBack, isLoading, selectedRecordId }) {
  return (
    <div className="share-history-view">
      <button type="button" className="share-back-button" onClick={onBack}><ArrowRight size={17} /> חזרה למרכז השיתוף</button>
      <div className="share-view-heading">
        <div><p>לקוחות וקישורים</p><h2>כל ההצעות במקום אחד</h2><span>חיפוש לפי שם, טלפון, מקום או סוג האירוע.</span></div>
        <span className="share-heading-mark"><History size={22} /></span>
      </div>
      <div className="share-history-tools">
        <label className="share-search-field"><Search size={18} /><input value={query} onChange={event => onQuery(event.target.value)} placeholder="חיפוש לקוח או אירוע…" /></label>
        <select value={status} onChange={event => onStatus(event.target.value)} aria-label="סינון לפי מצב">
          <option value="all">כל המצבים</option>
          <option value="active">פעילים</option>
          <option value="draft">טיוטות</option>
          <option value="expired">פגי תוקף</option>
          <option value="revoked">מבוטלים</option>
          <option value="archived">ארכיון</option>
        </select>
        <select value={sort} onChange={event => onSort(event.target.value)} aria-label="מיון הצעות">
          <option value="event-asc">אירועים קרובים</option>
          <option value="created-desc">נוצרו לאחרונה</option>
          <option value="name-asc">לפי שם</option>
        </select>
      </div>
      {isLoading ? (
        <div className="share-empty-state share-empty-state--large"><RefreshCw className="is-spinning" size={24} /><strong>טוענים את ההצעות…</strong></div>
      ) : !records.length ? (
        <div className="share-empty-state share-empty-state--large"><Search size={24} /><strong>לא נמצאו הצעות מתאימות</strong><span>אפשר לשנות את החיפוש או את הסינון.</span></div>
      ) : (
        <div className="share-history-list">
          {records.map(record => (
            <button
              key={record.id}
              type="button"
              className={`share-history-row ${record.id === selectedRecordId ? 'is-selected' : ''}`.trim()}
              data-share-id={record.id}
              aria-current={record.id === selectedRecordId ? 'true' : undefined}
              onClick={() => onSelect(record)}
            >
              <span className="share-avatar share-avatar--large">{String(record.clientName || '?').trim().slice(0, 1)}</span>
              <span className="share-history-main"><strong>{record.clientName}</strong><small>{record.eventType || 'אירוע'}{record.venue ? ` · ${record.venue}` : ''}</small></span>
              <span className="share-history-date"><CalendarDays size={15} /> {formatDate(record.eventDate)}</span>
              <span className="share-history-price">{pricingSummary(record)}</span>
              <ShareStatusBadge status={record.status} />
              <ChevronLeft size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShareDetail({ record, onBack, onCopy, onDuplicate, onRevoke, onArchive }) {
  if (!record) return null;
  const messageSnapshot = record.currentSnapshot?.messageSnapshot || record.messageSnapshot || {};
  const versions = record.versions || (record.currentSnapshot ? [record.currentSnapshot] : []);
  const whatsappHref = getWhatsAppHref({
    message: messageSnapshot.text || DEFAULT_CLIENT_SHARE_MESSAGE,
    includeText: messageSnapshot.includeText !== false,
    url: record.publicUrl,
    phone: record.clientPhone,
  });
  return (
    <div className="share-detail-view">
      <button type="button" className="share-back-button" onClick={onBack}><ArrowRight size={17} /> חזרה לרשימה</button>
      <div className="share-detail-hero">
        <span className="share-avatar share-avatar--hero">{String(record.clientName || '?').trim().slice(0, 1)}</span>
        <div><p>רשומת לקוח</p><h2>{record.clientName}</h2><span>{record.eventType || 'אירוע'}{record.eventDate ? ` · ${formatDate(record.eventDate)}` : ''}</span></div>
        <ShareStatusBadge status={record.status} />
      </div>
      <div className="share-detail-actions">
        <a className="share-button share-button--whatsapp" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
        <ActionButton Icon={Copy} onClick={() => onCopy(record.publicUrl, 'הקישור הועתק')}>העתקת קישור</ActionButton>
        <a className="share-button share-button--quiet" href={record.publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} /> תצוגה</a>
        <ActionButton Icon={MoreHorizontal} onClick={onDuplicate}>שכפול</ActionButton>
      </div>
      <div className="share-detail-grid">
        <section>
          <div className="share-section-heading"><div><p>אירוע</p><h3>פרטי הלקוח והאירוע</h3></div><UserRound size={18} /></div>
          <dl className="share-detail-list">
            <div><dt>טלפון</dt><dd dir="ltr">{record.clientPhone || '—'}</dd></div>
            <div><dt>אימייל</dt><dd dir="ltr">{record.clientEmail || '—'}</dd></div>
            <div><dt>מקום</dt><dd>{record.venue || '—'}</dd></div>
            <div><dt>נוצר</dt><dd>{formatCreatedAt(record.createdAt) || '—'}</dd></div>
            <div><dt>תוקף</dt><dd>{record.expiresAt ? formatCreatedAt(record.expiresAt) : 'ללא הגבלה'}</dd></div>
          </dl>
          {record.internalNotes && <div className="share-internal-note"><strong>הערה פנימית</strong><p>{record.internalNotes}</p></div>}
        </section>
        <section>
          <div className="share-section-heading"><div><p>ההצעה שנשלחה</p><h3>מחירים והודעה</h3></div><FilePenLine size={18} /></div>
          <p className="share-price-summary-full">{pricingSummary(record)}</p>
          <div className="share-saved-message"><strong>הודעת WhatsApp</strong><p>{messageSnapshot.includeText === false ? 'נשלח קישור בלבד' : (messageSnapshot.text || '—')}</p></div>
        </section>
      </div>
      <section className="share-version-history">
        <div className="share-section-heading"><div><p>תיעוד</p><h3>גרסאות ההצעה</h3></div><History size={18} /></div>
        <ol>
          {versions
            .slice()
            .sort((a, b) => Number(b.version || b.number || 0) - Number(a.version || a.number || 0))
            .map((version, index) => {
              const number = Number(version.version || version.number || versions.length - index);
              const isCurrent = number === Number(record.currentVersion || number);
              return (
                <li key={`${number}-${version.createdAt}`}><span>{number}</span><div><strong>גרסה {number}</strong><small>{formatCreatedAt(version.createdAt)}</small></div>{isCurrent && <em>נוכחית</em>}</li>
              );
            })}
        </ol>
      </section>
      <footer className="share-record-footer">
        <ActionButton Icon={Archive} onClick={onArchive}>העברה לארכיון</ActionButton>
        {record.status !== 'revoked' && <ActionButton Icon={X} variant="danger" onClick={onRevoke}>ביטול הקישור</ActionButton>}
      </footer>
    </div>
  );
}

export default function ShareCenter({ config, replaceConfig, onClose, closeButtonRef }) {
  const initialMessage = useMemo(() => getMessageSettings(config), [config]);
  const storageMode = getShareStorageMode();
  const [view, setView] = useState('home');
  const [message, setMessage] = useState(initialMessage.text);
  const [includeText, setIncludeText] = useState(initialMessage.includeText);
  const [records, setRecords] = useState([]);
  const [generalShare, setGeneralShare] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [createdShare, setCreatedShare] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('event-asc');
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishingGeneral, setIsPublishingGeneral] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [authSession, setAuthSession] = useState(storageMode === 'remote' ? undefined : null);
  const loadSequenceRef = useRef(0);
  const scrollRef = useRef(null);
  const previousViewRef = useRef('home');
  const historyScrollRef = useRef(0);
  const lastOpenedRecordIdRef = useRef('');
  const restoreHistoryFocusRef = useRef(false);
  const generalUrl = useMemo(() => getGeneralClientUrl(), []);
  const canUseShareCenter = storageMode !== 'remote' || Boolean(authSession?.access_token);

  useLayoutEffect(() => {
    const previousView = previousViewRef.current;
    const scrollContainer = scrollRef.current;
    if (scrollContainer && previousView !== view) {
      scrollContainer.scrollTop = view === 'history' && previousView === 'detail'
        ? historyScrollRef.current
        : 0;
      if (view === 'history' && previousView === 'detail' && restoreHistoryFocusRef.current) {
        restoreHistoryFocusRef.current = false;
        window.requestAnimationFrame(() => {
          const selectedRow = [...scrollContainer.querySelectorAll('.share-history-row')]
            .find(row => row.dataset.shareId === lastOpenedRecordIdRef.current);
          selectedRow?.focus({ preventScroll: true });
        });
      }
    }
    previousViewRef.current = view;
  }, [view]);

  const loadRecords = useCallback(async (filters = {}) => {
    const sequence = ++loadSequenceRef.current;
    setIsLoading(true);
    try {
      const next = await listShareRecords(filters);
      if (loadSequenceRef.current === sequence) setRecords(next);
    } catch (error) {
      if (loadSequenceRef.current === sequence) {
        setNotice(error.message || 'לא הצלחנו לטעון את רשימת ההצעות.');
      }
    } finally {
      if (loadSequenceRef.current === sequence) setIsLoading(false);
    }
  }, []);

  const loadGeneralShare = useCallback(async () => {
    if (storageMode === 'browser-demo') return;
    try {
      const generalRecords = await listShareRecords({
        kind: 'general',
        includeGeneral: true,
        sort: 'created-desc',
      });
      setGeneralShare(generalRecords[0] || null);
    } catch (error) {
      setNotice(error.message || 'לא הצלחנו לטעון את הקישור הכללי.');
    }
  }, [storageMode]);

  const goHome = useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setSort('event-asc');
    setView('home');
    if (storageMode === 'browser-demo') {
      setRecords([]);
      setIsLoading(false);
    } else {
      loadRecords();
    }
  }, [loadRecords, storageMode]);

  useEffect(() => {
    if (storageMode === 'browser-demo') {
      setRecords([]);
      setIsLoading(false);
      return;
    }
    if (storageMode === 'remote' && !authSession?.access_token) {
      setIsLoading(false);
      return;
    }
    loadRecords();
    loadGeneralShare();
  }, [authSession, loadGeneralShare, loadRecords, storageMode]);

  useEffect(() => {
    if (storageMode !== 'remote') return undefined;
    let isCurrent = true;
    if (!isShareAuthConfigured()) {
      setAuthSession(null);
      return undefined;
    }
    getShareAuthSession()
      .then(session => {
        if (isCurrent) setAuthSession(session);
      })
      .catch(error => {
        if (isCurrent) {
          setAuthSession(null);
          setNotice(error.message || 'יש להתחבר מחדש למרכז השיתוף.');
        }
      });
    return () => { isCurrent = false; };
  }, [storageMode]);

  useEffect(() => {
    if (view !== 'history' || !canUseShareCenter) return undefined;
    const timer = window.setTimeout(() => {
      loadRecords({ search: query, status: statusFilter, sort });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [canUseShareCenter, loadRecords, query, sort, statusFilter, view]);

  const handleSignIn = useCallback(async (email, password) => {
    const session = await signInShareUser(email, password);
    setAuthSession(session);
    setNotice('התחברתם למרכז השיתוף');
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutShareUser();
    setAuthSession(null);
    setRecords([]);
    setGeneralShare(null);
    setSelectedRecord(null);
    setView('home');
    setNotice('התנתקתם ממרכז השיתוף');
  }, []);

  const publishGeneralShare = useCallback(async () => {
    if (storageMode === 'browser-demo') {
      setNotice('יש לחבר מסד נתונים מאובטח לפני פרסום קישור כללי מותאם.');
      return;
    }
    setIsPublishingGeneral(true);
    try {
      const { resolvedConfig, resolvedPricing } = resolvePersonalizedPricing(config, {});
      const versionPayload = {
        resolvedConfig,
        resolvedPricing,
        pricingOverrides: {},
        messageSnapshot: { includeText, text: message },
        changeNote: generalShare ? 'עדכון האתר בקישור הכללי' : 'פרסום ראשון של האתר הכללי',
      };
      let nextShare;
      if (generalShare) {
        if (generalShare.status !== 'active') await restoreShareRecord(generalShare.id);
        nextShare = await createShareVersion(generalShare.id, versionPayload);
      } else {
        nextShare = await createShareRecord({
          kind: 'general',
          label: 'האתר הציבורי',
          clientName: 'האתר הציבורי',
          eventType: 'קישור כללי',
          ...versionPayload,
        });
      }
      setGeneralShare(nextShare);
      setNotice(generalShare ? 'האתר עודכן בקישור הכללי הקבוע' : 'הקישור הכללי פורסם ונשמר');
    } catch (error) {
      setNotice(error.message || 'לא הצלחנו לפרסם את הקישור הכללי.');
    } finally {
      setIsPublishingGeneral(false);
    }
  }, [config, generalShare, includeText, message, storageMode]);

  const saveMessageDefaults = useCallback(() => {
    replaceConfig(current => ({
      ...current,
      sharing: {
        ...(current.sharing || {}),
        clientMessage: {
          text: message,
          includeText,
          mode: includeText ? 'custom' : 'link-only',
          customMessage: message,
        },
      },
    }));
    setNotice('הודעת ברירת המחדל נשמרה');
  }, [includeText, message, replaceConfig]);

  const resetRecommendedMessage = useCallback(() => {
    setConfirmation({
      title: 'איפוס ההודעה המותאמת?',
      body: 'האיפוס ימחק את ההודעה שכתבת ויחזיר את הנוסח המומלץ.',
      confirmLabel: 'איפוס ההודעה',
      danger: true,
      onConfirm: async () => {
        setMessage(DEFAULT_CLIENT_SHARE_MESSAGE);
        setIncludeText(true);
        replaceConfig(current => ({
          ...current,
          sharing: {
            ...(current.sharing || {}),
            clientMessage: {
              text: DEFAULT_CLIENT_SHARE_MESSAGE,
              includeText: true,
              mode: 'default',
              customMessage: '',
            },
          },
        }));
        setNotice('ההודעה המומלצת הוחזרה');
      },
    });
  }, [replaceConfig]);

  const handleCopy = useCallback(async (text, successMessage) => {
    if (!text) return;
    try {
      await copyText(text);
      setNotice(successMessage || 'הועתק');
    } catch {
      setNotice('לא הצלחנו להעתיק אוטומטית. אפשר לסמן ולהעתיק ידנית.');
    }
  }, []);

  const openRecord = useCallback(async record => {
    if (view === 'history') historyScrollRef.current = scrollRef.current?.scrollTop || 0;
    lastOpenedRecordIdRef.current = record.id;
    setIsLoading(true);
    try {
      const full = await getShareRecord(record.id);
      setSelectedRecord(full || record);
      setView('detail');
    } catch (error) {
      setNotice(error.message || 'לא הצלחנו לפתוח את הרשומה.');
    } finally {
      setIsLoading(false);
    }
  }, [view]);

  const returnToHistory = useCallback(() => {
    restoreHistoryFocusRef.current = true;
    setView('history');
  }, []);

  const handleDuplicate = useCallback(async () => {
    if (!selectedRecord) return;
    try {
      const duplicate = await duplicateShareRecord(selectedRecord.id);
      setCreatedShare(duplicate);
      setView('success');
      await loadRecords();
      setNotice('נוצר עותק חדש עם קישור נפרד');
    } catch (error) {
      setNotice(error.message || 'לא הצלחנו לשכפל את ההצעה.');
    }
  }, [loadRecords, selectedRecord]);

  const confirmRecordAction = useCallback((action) => {
    if (!selectedRecord) return;
    const revoke = action === 'revoke';
    setConfirmation({
      title: revoke ? 'לבטל את הקישור?' : 'להעביר לארכיון?',
      body: revoke
        ? 'הלקוח לא יוכל לפתוח יותר את ההצעה. הרשומה והמחירים יישמרו בתיעוד.'
        : 'הרשומה תישמר ותהיה זמינה דרך סינון הארכיון.',
      confirmLabel: revoke ? 'ביטול הקישור' : 'העברה לארכיון',
      danger: revoke,
      onConfirm: async () => {
        const updated = revoke
          ? await revokeShareRecord(selectedRecord.id)
          : await archiveShareRecord(selectedRecord.id);
        setSelectedRecord(updated);
        await loadRecords({ search: query, status: statusFilter, sort });
        setNotice(revoke ? 'הקישור בוטל והרשומה נשמרה' : 'הרשומה הועברה לארכיון');
      },
    });
  }, [loadRecords, query, selectedRecord, sort, statusFilter]);

  return (
    <section className="share-center" role="dialog" aria-modal="true" aria-labelledby="share-center-title" dir="rtl">
      <header className="share-center-header">
        <div className="share-center-brand">
          <span><SweetLightLogo size={36} title="SweetLight" /></span>
          <div><small dir="ltr">SweetLight Selfie</small><strong id="share-center-title">מרכז השיתוף</strong></div>
        </div>
        <div className="share-center-header-actions">
          {view !== 'home' && <button type="button" onClick={goHome}><History size={17} /> ראשי</button>}
          {storageMode === 'remote' && authSession?.access_token && (
            <button type="button" onClick={handleSignOut}><LogOut size={17} /> יציאה</button>
          )}
          <button ref={closeButtonRef} type="button" className="share-center-close" onClick={onClose} aria-label="סגירת מרכז השיתוף"><X size={20} /></button>
        </div>
      </header>

      {storageMode === 'browser-demo' && (
        <div className="share-environment-note" role="status">
          <ShieldCheck size={17} />
          <span><strong>מצב תצוגה סטטי:</strong> קישורים אישיים מושבתים כדי שלא יישלח קישור שלא יעבוד אצל הלקוח. יש לחבר את מסד הנתונים המאובטח.</span>
        </div>
      )}

      <div ref={scrollRef} className="share-center-scroll">
        {storageMode === 'remote' && !authSession?.access_token && (
          <ShareLogin
            configured={isShareAuthConfigured()}
            isChecking={authSession === undefined}
            onSignIn={handleSignIn}
          />
        )}

        {canUseShareCenter && view === 'home' && (
          <div className="share-home-view">
            <div className="share-home-intro">
              <div><p>שיתוף מדויק, בלי לאבד תיעוד</p><h2>מה תרצו לשלוח?</h2><span>קישור כללי לכולם, או הצעה אישית עם מחירים מותאמים.</span></div>
              <span className="share-heading-mark"><Send size={22} /></span>
            </div>
            <GeneralLinkCard
              url={generalShare?.publicUrl || generalUrl}
              message={message}
              includeText={includeText}
              onCopy={handleCopy}
              onStatus={setNotice}
              published={Boolean(generalShare) || storageMode === 'browser-demo'}
              publishedAt={generalShare?.updatedAt || generalShare?.createdAt}
              canPublish={storageMode !== 'browser-demo'}
              isPublishing={isPublishingGeneral}
              onPublish={publishGeneralShare}
            />
            <button
              type="button"
              className="share-create-card"
              onClick={() => setView('create')}
              disabled={storageMode === 'browser-demo'}
              aria-describedby={storageMode === 'browser-demo' ? 'share-personal-disabled-note' : undefined}
            >
              <span className="share-create-card-icon"><Plus size={22} /></span>
              <span>
                <small>קישור שנשמר עם שם, אירוע ומחירים</small>
                <strong>יצירת הצעה אישית</strong>
                <em id="share-personal-disabled-note">{storageMode === 'browser-demo' ? 'נדרש חיבור למסד הנתונים' : 'המחירון הכללי לא ישתנה'}</em>
              </span>
              <ArrowLeft size={20} />
            </button>
            <MessageEditor
              message={message}
              includeText={includeText}
              onMessageChange={setMessage}
              onIncludeTextChange={setIncludeText}
              onSaveDefault={saveMessageDefaults}
              onReset={resetRecommendedMessage}
            />
            <RecentShares records={records} onOpenAll={() => setView('history')} onSelect={openRecord} />
          </div>
        )}

        {canUseShareCenter && view === 'create' && (
          <CreateOfferView
            config={config}
            message={message}
            includeText={includeText}
            onMessageChange={setMessage}
            onIncludeTextChange={setIncludeText}
            onSaveDefault={saveMessageDefaults}
            onResetMessage={resetRecommendedMessage}
            onBack={goHome}
            onStatus={setNotice}
            onCreated={async share => {
              setCreatedShare(share);
              setSelectedRecord(share);
              setView('success');
              await loadRecords();
              if (share.storageMode === 'browser-demo') {
                setNotice('ההצעה נשמרה במצב הדגמה בדפדפן הזה');
              } else {
                setNotice('ההצעה והקישור נשמרו');
              }
            }}
          />
        )}

        {canUseShareCenter && view === 'success' && createdShare && (
          <ShareSuccess
            share={createdShare}
            message={message}
            includeText={includeText}
            onCopy={handleCopy}
            onOpenRecord={() => openRecord(createdShare)}
            onNew={() => setView('create')}
          />
        )}

        {canUseShareCenter && view === 'history' && (
          <HistoryList
            records={records}
            query={query}
            status={statusFilter}
            sort={sort}
            onQuery={setQuery}
            onStatus={setStatusFilter}
            onSort={setSort}
            onSelect={openRecord}
            onBack={goHome}
            isLoading={isLoading}
            selectedRecordId={selectedRecord?.id || ''}
          />
        )}

        {canUseShareCenter && view === 'detail' && (
          <ShareDetail
            record={selectedRecord}
            onBack={returnToHistory}
            onCopy={handleCopy}
            onDuplicate={handleDuplicate}
            onRevoke={() => confirmRecordAction('revoke')}
            onArchive={() => confirmRecordAction('archive')}
          />
        )}
      </div>

      <div className="share-center-notice" aria-live="polite">{notice}</div>
      <ConfirmDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </section>
  );
}
