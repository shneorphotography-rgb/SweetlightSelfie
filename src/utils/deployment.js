const PUBLIC_ASSET_ROOTS = ['/portfolio-media/', '/uploads/', '/logo-clean.png'];

export const APP_BASE_URL = import.meta.env.BASE_URL || '/';
export const IS_STATIC_PREVIEW = import.meta.env.VITE_STATIC_PREVIEW === 'true';

function rebaseAssetPath(value) {
  if (typeof value !== 'string') return value;
  if (!PUBLIC_ASSET_ROOTS.some(prefix => value.startsWith(prefix))) return value;
  if (APP_BASE_URL === '/') return value;
  return `${APP_BASE_URL.replace(/\/$/, '')}${value}`;
}

export function withPublicBase(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return path;
  if (APP_BASE_URL === '/') return path;
  return `${APP_BASE_URL.replace(/\/$/, '')}${path}`;
}

export function rebasePublicAssets(value) {
  if (typeof value === 'string') return rebaseAssetPath(value);
  if (Array.isArray(value)) return value.map(rebasePublicAssets);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      rebaseAssetPath(key),
      rebasePublicAssets(entryValue),
    ]),
  );
}
