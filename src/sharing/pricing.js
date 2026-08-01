/**
 * Pure helpers for resolving a customer-specific pricing proposal.
 *
 * The public config currently stores display prices as strings (for example
 * `"7,500"`). This module keeps that shape in `resolvedConfig`, while the flat
 * `resolvedPricing` snapshot also exposes integer minor units for reliable
 * persistence, comparisons and sorting.
 */

export const PRICING_ITEM_KINDS = Object.freeze({
  PACKAGE: 'package',
  ADDON: 'addon',
});

export const PRICING_STATUSES = Object.freeze({
  PRICED: 'priced',
  INCLUDED: 'included',
  GIFT: 'gift',
});

export const DEFAULT_PRICING_CURRENCY = Object.freeze({
  code: 'ILS',
  symbol: '₪',
});

const STATUS_LABELS = Object.freeze({
  [PRICING_STATUSES.INCLUDED]: 'כלול',
  [PRICING_STATUSES.GIFT]: 'מתנה',
});

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneConfigValue(value) {
  if (Array.isArray(value)) return value.map(cloneConfigValue);
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneConfigValue(entry)]),
  );
}

function normalizeBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  }
  return Boolean(value);
}

function normalizeStatus(value, source = {}, fallback = PRICING_STATUSES.PRICED) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (Object.values(PRICING_STATUSES).includes(normalized)) return normalized;
  if (['regular', 'custom', 'price'].includes(normalized)) return PRICING_STATUSES.PRICED;

  if (source.gift === true) return PRICING_STATUSES.GIFT;
  if (source.included === true) return PRICING_STATUSES.INCLUDED;
  if (source.gift === false || source.included === false) return PRICING_STATUSES.PRICED;
  return fallback;
}

function normalizeCurrencyDisplay(value, fallback = DEFAULT_PRICING_CURRENCY.symbol) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  if (!normalized) return '';
  if (/^(ils|nis|ש[״"׳']?ח)$/iu.test(normalized)) return DEFAULT_PRICING_CURRENCY.symbol;
  return normalized;
}

function getCurrencyCode(display) {
  const value = String(display || '').trim();
  if (!value || value === DEFAULT_PRICING_CURRENCY.symbol || /^(ils|nis|ש[״"׳']?ח)$/iu.test(value)) {
    return DEFAULT_PRICING_CURRENCY.code;
  }
  return /^[a-z]{3}$/iu.test(value) ? value.toUpperCase() : null;
}

function parseNumericString(value) {
  let text = String(value)
    .normalize('NFKC')
    .trim()
    .replace(/(?:ILS|NIS)/giu, '')
    .replace(/₪/gu, '')
    .replace(/ש[״"׳']?ח/gu, '')
    .replace(/[\s\u00a0\u202f]/gu, '');

  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }

  if (!text || !/^[0-9.,]+$/.test(text)) return null;

  const commaPositions = [...text.matchAll(/,/g)].map(match => match.index);
  const dotPositions = [...text.matchAll(/\./g)].map(match => match.index);
  const separatorPositions = [...commaPositions, ...dotPositions].sort((a, b) => a - b);
  let decimalPosition = -1;

  if (commaPositions.length && dotPositions.length) {
    const candidate = separatorPositions.at(-1);
    const fractionalLength = text.length - candidate - 1;
    if (fractionalLength >= 1 && fractionalLength <= 2) decimalPosition = candidate;
  } else if (separatorPositions.length === 1) {
    const candidate = separatorPositions[0];
    const fractionalLength = text.length - candidate - 1;
    if (fractionalLength >= 1 && fractionalLength <= 2) decimalPosition = candidate;
    else if (fractionalLength !== 3) return null;
  } else if (separatorPositions.length > 1) {
    const separator = text[separatorPositions[0]];
    const groups = text.split(separator);
    const isThousandsGrouping = (
      groups[0].length >= 1
      && groups.slice(1).every(group => group.length === 3)
    );

    // Reusing one symbol for both grouping and decimals is ambiguous. Mixed
    // localized input remains supported when grouping and decimals use distinct
    // symbols (for example 7,500.50 or 7.500,50).
    if (!isThousandsGrouping) return null;
  }

  let integerText;
  let fractionalText = '';
  if (decimalPosition >= 0) {
    const groupedIntegerText = text.slice(0, decimalPosition);
    const groupingSeparators = groupedIntegerText.match(/[.,]/g) || [];
    if (groupingSeparators.length) {
      const uniqueSeparators = new Set(groupingSeparators);
      const groupingSeparator = groupingSeparators[0];
      const groups = groupedIntegerText.split(groupingSeparator);
      const hasValidGrouping = (
        uniqueSeparators.size === 1
        && /^\d{1,3}$/.test(groups[0])
        && groups.slice(1).every(group => /^\d{3}$/.test(group))
      );
      if (!hasValidGrouping) return null;
    }
    integerText = groupedIntegerText.replace(/[.,]/g, '');
    fractionalText = text.slice(decimalPosition + 1);
  } else {
    integerText = text.replace(/[.,]/g, '');
  }

  if (!/^\d+$/.test(integerText) || (fractionalText && !/^\d{1,2}$/.test(fractionalText))) {
    return null;
  }

  const majorUnits = Number(integerText);
  const minorRemainder = fractionalText ? Number(fractionalText.padEnd(2, '0')) : 0;
  if (!Number.isSafeInteger(majorUnits)) return null;

  const minorUnits = (majorUnits * 100) + minorRemainder;
  if (!Number.isSafeInteger(minorUnits)) return null;
  return negative ? -minorUnits : minorUnits;
}

/**
 * Parse a price expressed in major ILS units into integer agorot.
 *
 * Compatible examples: `7500`, `"7,500"`, `"₪7,500.50"` and
 * `"7.500,50"`. Invalid, unsafe or negative values return `null` by default.
 */
export function parseILSAmount(value, { allowNegative = false } = {}) {
  let minorUnits;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const roundingOffset = Math.sign(value || 1) * Number.EPSILON;
    minorUnits = Math.round((value + roundingOffset) * 100);
    if (!Number.isSafeInteger(minorUnits)) return null;
  } else if (typeof value === 'string') {
    minorUnits = parseNumericString(value);
    if (minorUnits === null) return null;
  } else {
    return null;
  }

  if (!allowNegative && minorUnits < 0) return null;
  return minorUnits;
}

/**
 * Format integer agorot for display. Currency is omitted by default because the
 * existing config renders `price` and `currency` separately.
 */
export function formatILSAmount(
  minorUnits,
  {
    includeCurrency = false,
    locale = 'en-US',
    currencyDisplay = 'narrowSymbol',
  } = {},
) {
  if (!Number.isSafeInteger(minorUnits)) return '';

  const amount = minorUnits / 100;
  const hasFraction = Math.abs(minorUnits % 100) > 0;
  return new Intl.NumberFormat(locale, {
    ...(includeCurrency
      ? { style: 'currency', currency: DEFAULT_PRICING_CURRENCY.code, currencyDisplay }
      : { style: 'decimal' }),
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Parse and normalize a legacy config price while preserving unparseable text. */
export function normalizeILSDisplayPrice(value) {
  if (value === undefined || value === null) return '';
  if (String(value).trim() === '') return '';
  const minorUnits = parseILSAmount(value);
  return minorUnits === null ? String(value).trim() : formatILSAmount(minorUnits);
}

function hashText(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/**
 * Return an existing item id unchanged, or a deterministic fallback for legacy
 * items. Persist the result with the config when upgrading old content so later
 * title edits cannot change that fallback id.
 */
export function createStablePricingItemId(kind, item = {}) {
  const explicitId = item.id === undefined || item.id === null ? '' : String(item.id).trim();
  if (explicitId) return explicitId;

  const safeKind = kind === PRICING_ITEM_KINDS.ADDON
    ? PRICING_ITEM_KINDS.ADDON
    : PRICING_ITEM_KINDS.PACKAGE;
  const identityText = [item.title, item.label, item.description].filter(Boolean).join('|');
  const readable = slugify(item.title || item.label) || 'item';
  return `${safeKind}-${readable}-${hashText(`${safeKind}|${identityText}`)}`;
}

function getPricingLocation(config) {
  if (isPlainObject(config?.sections?.pricing)) {
    return { type: 'sections', pricing: config.sections.pricing };
  }
  if (isPlainObject(config?.pricing)) {
    return { type: 'property', pricing: config.pricing };
  }
  if (isPlainObject(config) && ['packages', 'package', 'addons', 'services'].some(key => hasOwn(config, key))) {
    return { type: 'self', pricing: config };
  }
  return { type: 'missing', pricing: null };
}

function getPricingCollections(pricing) {
  const packageShape = Array.isArray(pricing?.packages)
    ? 'packages'
    : hasOwn(pricing || {}, 'package')
      ? 'package'
      : 'packages';
  const addonShape = Array.isArray(pricing?.addons)
    ? 'addons'
    : Array.isArray(pricing?.services)
      ? 'services'
      : 'addons';

  return {
    packageShape,
    addonShape,
    packages: packageShape === 'package'
      ? (pricing?.package ? [pricing.package] : [])
      : (Array.isArray(pricing?.packages) ? pricing.packages : []),
    addons: addonShape === 'services'
      ? pricing.services
      : (Array.isArray(pricing?.addons) ? pricing.addons : []),
  };
}

function assignStableIds(items, kind) {
  const usedIds = new Set();
  return items.map((item) => {
    const baseId = createStablePricingItemId(kind, item);
    let id = baseId;
    let duplicateNumber = 2;
    while (usedIds.has(id)) {
      id = `${baseId}--${duplicateNumber}`;
      duplicateNumber += 1;
    }
    usedIds.add(id);
    return { ...item, id };
  });
}

function writeCollections(pricing, collections, packages, addons) {
  if (collections.packageShape === 'package') {
    pricing.package = packages[0] || null;
  } else {
    pricing.packages = packages;
  }

  if (collections.addonShape === 'services') {
    pricing.services = addons;
  } else {
    pricing.addons = addons;
  }
}

/**
 * Clone a full config (or a standalone pricing object) and add unique ids to any
 * legacy package/addon that does not have one. The input is never mutated.
 */
export function ensureStablePricingIds(baseConfig) {
  const clonedConfig = cloneConfigValue(baseConfig);
  const location = getPricingLocation(clonedConfig);
  if (!location.pricing) return clonedConfig;

  const collections = getPricingCollections(location.pricing);
  writeCollections(
    location.pricing,
    collections,
    assignStableIds(collections.packages, PRICING_ITEM_KINDS.PACKAGE),
    assignStableIds(collections.addons, PRICING_ITEM_KINDS.ADDON),
  );
  return clonedConfig;
}

function addOverrideEntries(target, entries, kind = '*') {
  if (Array.isArray(entries)) {
    entries.forEach((entry) => {
      if (!isPlainObject(entry)) return;
      const id = String(entry.id ?? entry.itemId ?? '').trim();
      const entryKind = entry.kind === PRICING_ITEM_KINDS.ADDON
        ? PRICING_ITEM_KINDS.ADDON
        : entry.kind === PRICING_ITEM_KINDS.PACKAGE
          ? PRICING_ITEM_KINDS.PACKAGE
          : kind;
      if (id) target.set(`${entryKind}:${id}`, entry);
    });
    return;
  }

  if (!isPlainObject(entries)) return;
  Object.entries(entries).forEach(([rawKey, entry]) => {
    if (!isPlainObject(entry)) return;
    const keyMatch = rawKey.match(/^(package|addon):(.*)$/u);
    const entryKind = keyMatch?.[1] || kind;
    const id = String(entry.id ?? entry.itemId ?? keyMatch?.[2] ?? rawKey).trim();
    if (id) target.set(`${entryKind}:${id}`, entry);
  });
}

/**
 * Normalize supported override inputs into a serializable flat array.
 *
 * Preferred input shape:
 * `{ packages: { [id]: override }, addons: { [id]: override } }`.
 * `items` maps/arrays and a direct override array are accepted for compatibility.
 */
export function normalizePricingOverrides(overrides = {}) {
  const normalized = new Map();

  if (Array.isArray(overrides)) {
    addOverrideEntries(normalized, overrides);
  } else if (isPlainObject(overrides)) {
    addOverrideEntries(normalized, overrides.items);
    addOverrideEntries(normalized, overrides.packages ?? overrides.package, PRICING_ITEM_KINDS.PACKAGE);
    addOverrideEntries(normalized, overrides.addons ?? overrides.services, PRICING_ITEM_KINDS.ADDON);

    const hasNamedCollections = ['items', 'packages', 'package', 'addons', 'services']
      .some(key => hasOwn(overrides, key));
    if (!hasNamedCollections) addOverrideEntries(normalized, overrides);
  }

  return [...normalized.entries()].map(([key, override]) => {
    const separator = key.indexOf(':');
    return {
      key,
      kind: key.slice(0, separator),
      id: key.slice(separator + 1),
      ...override,
    };
  });
}

function createOverrideLookup(overrides) {
  return new Map(normalizePricingOverrides(overrides).map(entry => [entry.key, entry]));
}

function resolvePriceValue(baseItem, override) {
  if (hasOwn(override, 'priceMinor') || hasOwn(override, 'amountMinor')) {
    const candidate = override.priceMinor ?? override.amountMinor;
    if (Number.isSafeInteger(candidate) && candidate >= 0) {
      return {
        display: formatILSAmount(candidate),
        amountMinor: candidate,
      };
    }
    return { display: '', amountMinor: null };
  }

  const value = hasOwn(override, 'price') ? override.price : baseItem.price;
  return {
    display: normalizeILSDisplayPrice(value),
    amountMinor: parseILSAmount(value),
  };
}

function getBaseStatus(item) {
  return normalizeStatus(item.pricingStatus ?? item.status, item, PRICING_STATUSES.PRICED);
}

function resolveItem(item, kind, index, override) {
  const baseVisible = item.visible !== false;
  const baseStatus = getBaseStatus(item);
  const baseCurrency = normalizeCurrencyDisplay(item.currency);
  const basePrice = normalizeILSDisplayPrice(item.price);
  const basePriceAmountMinor = parseILSAmount(item.price);
  const basePriceNote = item.priceNote === undefined || item.priceNote === null
    ? ''
    : String(item.priceNote);
  const hasOverride = isPlainObject(override);
  const safeOverride = hasOverride ? override : {};
  const visible = normalizeBoolean(safeOverride.visible, baseVisible);
  const status = normalizeStatus(
    safeOverride.pricingStatus ?? safeOverride.status,
    safeOverride,
    baseStatus,
  );
  const currency = normalizeCurrencyDisplay(
    hasOwn(safeOverride, 'currency') ? safeOverride.currency : baseCurrency,
    baseCurrency,
  );
  const priceResult = resolvePriceValue(item, safeOverride);
  const priceNote = hasOwn(safeOverride, 'priceNote')
    ? String(safeOverride.priceNote ?? '')
    : basePriceNote;
  const showOriginalPrice = (
    status === PRICING_STATUSES.PRICED
    && normalizeBoolean(safeOverride.showOriginalPrice, false)
    && priceResult.display !== basePrice
    && Boolean(basePrice)
  );
  const displayPrice = status === PRICING_STATUSES.PRICED
    ? priceResult.display
    : STATUS_LABELS[status];
  const displayCurrency = status === PRICING_STATUSES.PRICED ? currency : '';
  const resolvedItem = {
    ...item,
    visible,
    pricingStatus: status,
    included: status === PRICING_STATUSES.INCLUDED,
    gift: status === PRICING_STATUSES.GIFT,
    price: displayPrice,
    currency: displayCurrency,
    priceNote,
    showOriginalPrice,
    originalPrice: showOriginalPrice ? basePrice : '',
    originalCurrency: showOriginalPrice ? baseCurrency : '',
  };
  const changed = (
    visible !== baseVisible
    || status !== baseStatus
    || priceResult.display !== basePrice
    || currency !== baseCurrency
    || priceNote !== basePriceNote
    || showOriginalPrice
  );

  return {
    resolvedItem,
    snapshot: {
      key: `${kind}:${item.id}`,
      id: item.id,
      kind,
      index,
      title: String(item.title || ''),
      label: String(item.label || ''),
      visible,
      status,
      price: displayPrice,
      amountMinor: priceResult.amountMinor,
      currency: displayCurrency,
      currencyCode: getCurrencyCode(currency),
      priceNote,
      showOriginalPrice,
      baseVisible,
      baseStatus,
      basePrice,
      baseAmountMinor: basePriceAmountMinor,
      baseCurrency,
      baseCurrencyCode: getCurrencyCode(baseCurrency),
      basePriceNote,
      hasOverride,
      changed,
    },
  };
}

/**
 * Resolve personalized package/addon overrides without mutating `baseConfig`.
 *
 * Hidden items remain in `resolvedPricing` for audit history but are removed
 * from the pricing collections in `resolvedConfig`, so the existing public
 * PricingSection does not need special visibility handling.
 */
export function resolvePersonalizedPricing(baseConfig, overrides = {}) {
  const resolvedConfig = ensureStablePricingIds(baseConfig);
  const location = getPricingLocation(resolvedConfig);
  if (!location.pricing) return { resolvedConfig, resolvedPricing: [] };

  const collections = getPricingCollections(location.pricing);
  const overrideLookup = createOverrideLookup(overrides);
  const resolvedPricing = [];

  const resolveCollection = (items, kind) => items
    .map((item, index) => {
      const override = (
        overrideLookup.get(`${kind}:${item.id}`)
        || overrideLookup.get(`*:${item.id}`)
      );
      const result = resolveItem(item, kind, index, override);
      resolvedPricing.push(result.snapshot);
      return result.resolvedItem;
    })
    .filter(item => item.visible);

  const packages = resolveCollection(collections.packages, PRICING_ITEM_KINDS.PACKAGE);
  const addons = resolveCollection(collections.addons, PRICING_ITEM_KINDS.ADDON);
  writeCollections(location.pricing, collections, packages, addons);

  return { resolvedConfig, resolvedPricing };
}

// Concise alias for consumers that already operate inside a sharing domain.
export const resolvePricing = resolvePersonalizedPricing;
