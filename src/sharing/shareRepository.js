import { IS_STATIC_PREVIEW } from '../utils/deployment';
import { buildClientViewUrl } from '../utils/clientView';
import { getShareAccessToken, isShareAuthConfigured } from './shareAuth';

const API_BASE_URL = String(import.meta.env.VITE_SHARE_API_BASE_URL || '').replace(/\/$/, '');
const LOCAL_STORE_KEY = 'sweetlight-selfie:share-records:v1';
const LOCAL_PUBLIC_PREFIX = 'sweetlight-selfie:public-share:';

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function getLocalStore() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_STORE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalStore(records) {
  window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(records));
}

function createOpaqueToken() {
  const bytes = new Uint8Array(18);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `share-${Date.now()}-${createOpaqueToken().slice(0, 10)}`;
}

function getLocalPublicUrl(token) {
  return buildClientViewUrl(window.location.origin, token);
}

function saveLocalPublicSnapshot(token, snapshot) {
  window.localStorage.setItem(
    `${LOCAL_PUBLIC_PREFIX}${token}`,
    JSON.stringify(snapshot),
  );
}

function readLocalPublicSnapshot(token) {
  try {
    const raw = window.localStorage.getItem(`${LOCAL_PUBLIC_PREFIX}${token}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function removeLocalPublicSnapshot(token) {
  window.localStorage.removeItem(`${LOCAL_PUBLIC_PREFIX}${token}`);
}

async function request(path, options = {}) {
  const { auth = true, ...fetchOptions } = options;
  let accessToken = '';
  if (API_BASE_URL && auth) {
    if (!isShareAuthConfigured()) {
      throw new Error('חסרות הגדרות ההתחברות המאובטחת של מרכז השיתוף.');
    }
    accessToken = await getShareAccessToken();
    if (!accessToken) throw new Error('יש להתחבר למרכז השיתוף.');
  }
  const response = await fetch(apiUrl(path), {
    ...fetchOptions,
    headers: {
      Accept: 'application/json',
      ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(fetchOptions.headers || {}),
    },
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(data?.error || 'Share service is unavailable');
  }
  return data;
}

function normalizeLocalStatus(record) {
  if (record.status === 'revoked' || record.status === 'archived') return record.status;
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) return 'expired';
  return record.status || 'active';
}

function matchesSearch(record, search) {
  if (!search) return true;
  const needle = search.trim().toLocaleLowerCase('he');
  if (!needle) return true;
  return [
    record.clientName,
    record.clientPhone,
    record.clientEmail,
    record.eventType,
    record.eventDate,
    record.venue,
    record.label,
  ].some(value => String(value || '').toLocaleLowerCase('he').includes(needle));
}

function sortLocalRecords(records, sort = 'event-asc') {
  const next = [...records];
  if (sort === 'created-desc') {
    return next.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  if (sort === 'name-asc') {
    return next.sort((a, b) => String(a.clientName).localeCompare(String(b.clientName), 'he'));
  }
  return next.sort((a, b) => {
    if (!a.eventDate && !b.eventDate) return String(b.createdAt).localeCompare(String(a.createdAt));
    if (!a.eventDate) return 1;
    if (!b.eventDate) return -1;
    return String(a.eventDate).localeCompare(String(b.eventDate));
  });
}

export function isShareBackendConfigured() {
  return Boolean(API_BASE_URL) || !IS_STATIC_PREVIEW;
}

export function getShareStorageMode() {
  if (API_BASE_URL) return 'remote';
  return IS_STATIC_PREVIEW ? 'browser-demo' : 'local-server';
}

export function getGeneralClientUrl() {
  return buildClientViewUrl(window.location.origin);
}

export async function listShareRecords({
  search = '',
  status = 'all',
  sort = 'event-asc',
  includeGeneral = false,
  kind = includeGeneral ? 'all' : 'personal',
} = {}) {
  if (IS_STATIC_PREVIEW && !API_BASE_URL) return [];

  if (!IS_STATIC_PREVIEW || API_BASE_URL) {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (status && status !== 'all') query.set('status', status);
    if (sort) query.set('sort', sort);
    if (kind && kind !== 'all') query.set('kind', kind);
    const suffix = query.toString() ? `?${query}` : '';
    const data = await request(`/api/shares${suffix}`);
    return (data.shares || [])
      .map(record => ({ ...record, status: normalizeLocalStatus(record) }))
      .filter(record => kind === 'all' || (record.kind || 'personal') === kind)
      .filter(record => includeGeneral || record.kind !== 'general')
      .filter(record => status === 'all' || record.status === status);
  }

  const records = getLocalStore()
    .map(record => ({ ...record, status: normalizeLocalStatus(record) }))
    .filter(record => kind === 'all' || (record.kind || 'personal') === kind)
    .filter(record => includeGeneral || record.kind !== 'general')
    .filter(record => matchesSearch(record, search))
    .filter(record => status === 'all' || record.status === status);
  return sortLocalRecords(records, sort);
}

export async function getShareRecord(id) {
  if (!IS_STATIC_PREVIEW || API_BASE_URL) {
    const data = await request(`/api/shares/${encodeURIComponent(id)}`);
    return data.share ? { ...data.share, status: normalizeLocalStatus(data.share) } : null;
  }
  return getLocalStore().find(record => record.id === id) || null;
}

export async function createShareRecord(payload) {
  if (!IS_STATIC_PREVIEW || API_BASE_URL) {
    const data = await request('/api/shares', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.share;
  }

  const now = new Date().toISOString();
  const id = createId();
  const token = createOpaqueToken();
  const version = {
    version: 1,
    schemaVersion: 1,
    pricingOverrides: payload.pricingOverrides || {},
    resolvedPricing: payload.resolvedPricing || { packages: [], addons: [] },
    resolvedConfig: payload.resolvedConfig,
    messageSnapshot: payload.messageSnapshot || { includeText: true, text: '' },
    createdAt: now,
  };
  const share = {
    id,
    kind: payload.kind === 'general' ? 'general' : 'personal',
    label: payload.label || payload.clientName,
    clientName: payload.clientName,
    clientPhone: payload.clientPhone || '',
    clientEmail: payload.clientEmail || '',
    eventType: payload.eventType || '',
    eventDate: payload.eventDate || '',
    venue: payload.venue || '',
    internalNotes: payload.internalNotes || '',
    status: 'active',
    token,
    publicUrl: getLocalPublicUrl(token),
    currentVersion: 1,
    currentSnapshot: version,
    versions: [version],
    createdAt: now,
    updatedAt: now,
    lastSharedAt: null,
    expiresAt: payload.expiresAt || null,
    storageMode: 'browser-demo',
  };
  setLocalStore([share, ...getLocalStore()]);
  saveLocalPublicSnapshot(token, {
    config: payload.resolvedConfig,
    share: {
      status: 'active',
      expiresAt: payload.expiresAt || null,
      version: 1,
    },
  });
  return share;
}

export async function createShareVersion(id, payload) {
  if (!IS_STATIC_PREVIEW || API_BASE_URL) {
    const data = await request(`/api/shares/${encodeURIComponent(id)}/versions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.share;
  }

  const source = getLocalStore().find(record => record.id === id);
  if (!source) throw new Error('Share not found');
  const now = new Date().toISOString();
  const number = Number(source.currentVersion || 0) + 1;
  const version = {
    version: number,
    number,
    schemaVersion: 1,
    pricingOverrides: payload.pricingOverrides || {},
    resolvedPricing: payload.resolvedPricing || { packages: [], addons: [] },
    resolvedConfig: payload.resolvedConfig,
    messageSnapshot: payload.messageSnapshot || { includeText: true, text: '' },
    changeNote: payload.changeNote || '',
    createdAt: now,
  };
  const updated = await updateShareRecord(id, {
    currentVersion: number,
    currentSnapshot: version,
    versions: [...(source.versions || []), version],
  });
  if (source.token) {
    saveLocalPublicSnapshot(source.token, {
      config: payload.resolvedConfig,
      share: { status: updated.status, expiresAt: updated.expiresAt, version: number },
    });
  }
  return updated;
}

export async function updateShareRecord(id, payload) {
  if (!IS_STATIC_PREVIEW || API_BASE_URL) {
    const data = await request(`/api/shares/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return data.share;
  }

  let updated = null;
  const records = getLocalStore().map(record => {
    if (record.id !== id) return record;
    updated = { ...record, ...payload, updatedAt: new Date().toISOString() };
    return updated;
  });
  setLocalStore(records);
  return updated;
}

async function runShareAction(id, action) {
  if (!IS_STATIC_PREVIEW || API_BASE_URL) {
    const data = await request(`/api/shares/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
    });
    return data.share;
  }

  const source = getLocalStore().find(record => record.id === id);
  if (!source) throw new Error('Share not found');

  if (action === 'duplicate') {
    return createShareRecord({
      ...source,
      label: `${source.label || source.clientName} — עותק`,
      ...source.currentSnapshot,
    });
  }

  const status = action === 'revoke' ? 'revoked' : action === 'restore' ? 'active' : 'archived';
  if (source.token) {
    const snapshot = readLocalPublicSnapshot(source.token);
    if (snapshot) saveLocalPublicSnapshot(source.token, {
      ...snapshot,
      share: { ...(snapshot.share || {}), status },
    });
  }
  return updateShareRecord(id, { status });
}

export function duplicateShareRecord(id) {
  return runShareAction(id, 'duplicate');
}

export function revokeShareRecord(id) {
  return runShareAction(id, 'revoke');
}

export function archiveShareRecord(id) {
  return runShareAction(id, 'archive');
}

export function restoreShareRecord(id) {
  return runShareAction(id, 'restore');
}

export async function loadPublicShare(token) {
  if (!token) return null;
  if (!IS_STATIC_PREVIEW || API_BASE_URL) {
    try {
      return await request(`/api/public-shares/${encodeURIComponent(token)}`, { auth: false });
    } catch (error) {
      if (API_BASE_URL) throw error;
      return request(`/api/client-shares/${encodeURIComponent(token)}`, { auth: false });
    }
  }
  const snapshot = readLocalPublicSnapshot(token);
  if (!snapshot) throw new Error('Shared configuration is unavailable');
  if (snapshot.share?.status && snapshot.share.status !== 'active') {
    throw new Error('Shared configuration is no longer active');
  }
  if (snapshot.share?.expiresAt && new Date(snapshot.share.expiresAt).getTime() < Date.now()) {
    throw new Error('Shared configuration has expired');
  }
  return snapshot;
}
