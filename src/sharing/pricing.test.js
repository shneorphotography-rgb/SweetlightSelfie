import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRICING_STATUSES,
  createStablePricingItemId,
  ensureStablePricingIds,
  formatILSAmount,
  normalizeILSDisplayPrice,
  normalizePricingOverrides,
  parseILSAmount,
  resolvePersonalizedPricing,
} from './pricing.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

test('parses current and localized ILS price strings into agorot', () => {
  assert.equal(parseILSAmount('7,500'), 750000);
  assert.equal(parseILSAmount('₪7,500.50'), 750050);
  assert.equal(parseILSAmount('7.500,50'), 750050);
  assert.equal(parseILSAmount('1,5'), 150);
  assert.equal(parseILSAmount(1300), 130000);
  assert.equal(parseILSAmount(1.005), 101);
  assert.equal(parseILSAmount('-50'), null);
  assert.equal(parseILSAmount('-50', { allowNegative: true }), -5000);
  assert.equal(parseILSAmount('7,50,0'), null);
  assert.equal(parseILSAmount('1,234,50'), null);
  assert.equal(parseILSAmount('free'), null);
});

test('formats agorot and preserves non-numeric legacy display text', () => {
  assert.equal(formatILSAmount(750000), '7,500');
  assert.equal(formatILSAmount(750050), '7,500.50');
  assert.equal(normalizeILSDisplayPrice('7500'), '7,500');
  assert.equal(normalizeILSDisplayPrice('לפי הצעה'), 'לפי הצעה');
});

test('keeps explicit ids and creates deterministic ids for legacy items', () => {
  assert.equal(createStablePricingItemId('package', { id: 'main-package' }), 'main-package');
  const first = createStablePricingItemId('addon', { title: 'אלבומים' });
  const second = createStablePricingItemId('addon', { title: 'אלבומים' });
  assert.equal(first, second);

  const config = { sections: { pricing: { packages: [{ title: 'בסיס' }], addons: [] } } };
  const upgraded = ensureStablePricingIds(config);
  assert.ok(upgraded.sections.pricing.packages[0].id.startsWith('package-'));
  assert.equal(config.sections.pricing.packages[0].id, undefined);
});

test('resolves personal prices, visibility and gift status without mutation', () => {
  const baseConfig = deepFreeze({
    sections: {
      pricing: {
        packages: [{
          id: 'full-day',
          title: 'יום מלא',
          price: '7,500',
          currency: '₪',
          priceNote: 'כולל מע״מ',
        }],
        addons: [
          { id: 'albums', title: 'אלבומים', price: '1,500', currency: '₪' },
          { id: 'magnets', title: 'מגנטים', price: '2,600', currency: '₪' },
        ],
      },
    },
  });

  const { resolvedConfig, resolvedPricing } = resolvePersonalizedPricing(baseConfig, {
    packages: {
      'full-day': { price: 6900, priceNote: 'מחיר אישי' },
    },
    addons: {
      albums: { status: 'gift' },
      magnets: { visible: false },
    },
  });

  const pricing = resolvedConfig.sections.pricing;
  assert.equal(pricing.packages[0].price, '6,900');
  assert.equal(pricing.packages[0].priceNote, 'מחיר אישי');
  assert.equal(pricing.addons.length, 1);
  assert.equal(pricing.addons[0].price, 'מתנה');
  assert.equal(pricing.addons[0].currency, '');

  const packageSnapshot = resolvedPricing.find(item => item.id === 'full-day');
  assert.equal(packageSnapshot.amountMinor, 690000);
  assert.equal(packageSnapshot.baseAmountMinor, 750000);
  assert.equal(packageSnapshot.changed, true);

  const giftSnapshot = resolvedPricing.find(item => item.id === 'albums');
  assert.equal(giftSnapshot.status, PRICING_STATUSES.GIFT);
  assert.equal(giftSnapshot.amountMinor, 150000);

  const hiddenSnapshot = resolvedPricing.find(item => item.id === 'magnets');
  assert.equal(hiddenSnapshot.visible, false);
  assert.equal(baseConfig.sections.pricing.addons.length, 2);
  assert.equal(baseConfig.sections.pricing.packages[0].price, '7,500');
});

test('supports legacy singular package/services config and included booleans', () => {
  const legacyPricing = {
    package: { title: 'חבילה', price: '5000', currency: 'ILS' },
    services: [{ id: 'extra', title: 'תוספת', price: '500' }],
  };
  const stable = ensureStablePricingIds(legacyPricing);
  const packageId = stable.package.id;
  const { resolvedConfig, resolvedPricing } = resolvePersonalizedPricing(legacyPricing, {
    items: [
      { kind: 'package', id: packageId, included: true },
      { kind: 'addon', id: 'extra', priceMinor: 42500, currency: '₪' },
    ],
  });

  assert.equal(resolvedConfig.package.price, 'כלול');
  assert.equal(resolvedConfig.services[0].price, '425');
  assert.equal(resolvedPricing.length, 2);
  assert.equal(resolvedPricing[0].status, PRICING_STATUSES.INCLUDED);
});

test('normalizes preferred keyed override maps into a flat serializable list', () => {
  assert.deepEqual(
    normalizePricingOverrides({
      packages: { main: { price: '6,900' } },
      addons: { album: { visible: false } },
    }).map(({ key, kind, id }) => ({ key, kind, id })),
    [
      { key: 'package:main', kind: 'package', id: 'main' },
      { key: 'addon:album', kind: 'addon', id: 'album' },
    ],
  );
});
