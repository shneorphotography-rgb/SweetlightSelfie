const CLIENT_VIEW_PARAM = 'view';
const CLIENT_VIEW_VALUE = 'client';
const CLIENT_SHARE_PARAM = 'share';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isPrivateIpv4(hostname) {
  if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return true;
  const match = hostname.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function isLocalDevelopmentHost(hostname) {
  return LOCAL_HOSTNAMES.has(hostname) || isPrivateIpv4(hostname);
}

export function isClientView() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(CLIENT_VIEW_PARAM) === CLIENT_VIEW_VALUE;
}

export function getClientShareToken() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(CLIENT_SHARE_PARAM);
}

export function buildClientViewUrl(origin = window.location.origin, shareToken = null) {
  const currentUrl = new URL(window.location.href);
  const clientUrl = new URL(`${currentUrl.pathname}${currentUrl.search}`, origin);

  clientUrl.searchParams.set(CLIENT_VIEW_PARAM, CLIENT_VIEW_VALUE);
  clientUrl.searchParams.delete('edit');
  if (shareToken) {
    clientUrl.searchParams.set(CLIENT_SHARE_PARAM, shareToken);
  } else {
    clientUrl.searchParams.delete(CLIENT_SHARE_PARAM);
  }
  clientUrl.hash = '';

  return clientUrl.toString();
}

async function createClientSnapshot(config) {
  const response = await fetch('/api/client-shares', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ config }),
  });

  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Client snapshot is unavailable');
  }

  const data = await response.json();
  if (!data.token) throw new Error('Client snapshot token is missing');
  return data.token;
}

export async function resolveClientViewUrl(config) {
  const currentUrl = new URL(window.location.href);
  let shareOrigin = currentUrl.origin;
  let shareToken = null;

  if (LOCAL_HOSTNAMES.has(currentUrl.hostname)) {
    try {
      const response = await fetch('/api/share-info', {
        headers: { Accept: 'application/json' },
      });

      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        if (data.origin) shareOrigin = data.origin;
      }
    } catch {
      throw new Error('Local network address is unavailable');
    }
  }

  if (isLocalDevelopmentHost(currentUrl.hostname)) {
    shareToken = await createClientSnapshot(config);
  }

  return buildClientViewUrl(shareOrigin, shareToken);
}
