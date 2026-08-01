const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
const SESSION_KEY = 'sweetlight-selfie:share-auth:v1';
const REFRESH_MARGIN_MS = 60_000;
let volatileSession = null;

if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be disabled; authentication will simply remain in-memory only.
  }
}

function readStoredSession() {
  if (typeof window === 'undefined') return null;
  try {
    // GitHub Pages projects under the same account share an origin. Keep owner
    // credentials tab-scoped and remove sessions written by older builds.
    window.localStorage.removeItem(SESSION_KEY);
    const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || 'null');
    return session && session.access_token && session.refresh_token ? session : null;
  } catch {
    return volatileSession;
  }
}

function storeSession(session) {
  if (typeof window === 'undefined') return;
  if (!session) {
    volatileSession = null;
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Keep the signed-out state in memory when storage is unavailable.
    }
    return;
  }
  const expiresAt = session.expires_at
    ? Number(session.expires_at) * 1000
    : Date.now() + Number(session.expires_in || 3600) * 1000;
  const storedSession = { ...session, expiresAt };
  volatileSession = storedSession;
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));
  } catch {
    // The current tab can still use the in-memory session.
  }
}

async function authRequest(path, body, accessToken = '') {
  if (!isShareAuthConfigured()) {
    throw new Error('חסרות הגדרות ההתחברות המאובטחת של מרכז השיתוף.');
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.msg || data.error_description || data.message || 'ההתחברות נכשלה.');
  }
  return data;
}

async function refreshSession(session) {
  try {
    const next = await authRequest('token?grant_type=refresh_token', {
      refresh_token: session.refresh_token,
    });
    storeSession(next);
    return { ...next, expiresAt: Date.now() + Number(next.expires_in || 3600) * 1000 };
  } catch (error) {
    storeSession(null);
    throw error;
  }
}

export function isShareAuthConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function getShareAuthSession() {
  const session = readStoredSession();
  if (!session) return null;
  const expiresAt = Number(session.expiresAt || 0);
  if (expiresAt && expiresAt - REFRESH_MARGIN_MS > Date.now()) return session;
  return refreshSession(session);
}

export async function getShareAccessToken() {
  const session = await getShareAuthSession();
  return session?.access_token || '';
}

export async function signInShareUser(email, password) {
  const session = await authRequest('token?grant_type=password', {
    email: String(email || '').trim(),
    password: String(password || ''),
  });
  storeSession(session);
  return { ...session, expiresAt: Date.now() + Number(session.expires_in || 3600) * 1000 };
}

export async function signOutShareUser() {
  const session = readStoredSession();
  try {
    if (session?.access_token) {
      await authRequest('logout', {}, session.access_token);
    }
  } finally {
    storeSession(null);
  }
}
