export function normalizeWhatsAppNumber(value = '') {
  const digits = String(value).replace(/\D/g, '');

  if (!digits) return '';
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;

  return digits;
}

export function getWhatsAppHref(value, text) {
  const normalized = normalizeWhatsAppNumber(value);
  if (!normalized) return '#';

  const base = `https://wa.me/${normalized}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export async function submitContactForm(destinationEmail, payload) {
  if (!destinationEmail) {
    throw new Error('לא הוגדרה כתובת מייל לקבלת הפניות.');
  }

  const body = new FormData();
  body.append('name', payload.name || '');
  body.append('email', payload.email || '');
  body.append('phone', payload.phone || '');
  body.append('event_date', payload.date || '');
  body.append('message', payload.message || '');
  body.append('_subject', `פניה חדשה מהאתר - ${payload.name || 'ללא שם'}`);
  body.append('_replyto', payload.email || destinationEmail);
  body.append('_captcha', 'false');
  body.append('_template', 'table');

  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(destinationEmail)}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success === false || result?.success === 'false') {
    throw new Error(result?.message || 'שליחת הפניה נכשלה. נסו שוב בעוד רגע.');
  }

  return result;
}
