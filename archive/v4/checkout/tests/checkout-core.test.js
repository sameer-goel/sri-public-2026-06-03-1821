// ============================================
// Om Sacred Space - Checkout core test suite
// Run with:  npm test   (node --test)
// No runtime dependencies; uses Node's built-in test runner + assert.
// ============================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Pay = require('../checkout-core.js');

// --- formatPrice -----------------------------------------------------------
test('formatPrice: whole EUR has no decimals', () => {
  assert.equal(Pay.formatPrice(4500, 'EUR'), '\u20AC45');
  assert.equal(Pay.formatPrice(110000, 'EUR'), '\u20AC1100');
});

test('formatPrice: fractional amount shows two decimals', () => {
  assert.equal(Pay.formatPrice(2050, 'EUR'), '\u20AC20.50');
});

test('formatPrice: GBP and USD symbols', () => {
  assert.equal(Pay.formatPrice(1900, 'GBP'), '\u00A319');
  assert.equal(Pay.formatPrice(999, 'USD'), '$9.99');
});

test('formatPrice: unknown currency falls back to no symbol', () => {
  assert.equal(Pay.formatPrice(1000, 'XYZ'), '10');
});

// --- getProduct / allProducts ----------------------------------------------
test('getProduct: returns a known product', () => {
  const p = Pay.getProduct('session-foundations');
  assert.ok(p);
  assert.equal(p.priceMinor, 4500);
  assert.equal(p.currency, 'EUR');
});

test('getProduct: returns null for unknown id', () => {
  assert.equal(Pay.getProduct('does-not-exist'), null);
});

test('allProducts: returns the full catalog as an array', () => {
  const all = Pay.allProducts();
  assert.ok(Array.isArray(all));
  assert.equal(all.length, Object.keys(Pay.CATALOG).length);
});

// --- normalizeHeading ------------------------------------------------------
test('normalizeHeading: strips leading emoji and trims', () => {
  assert.equal(Pay.normalizeHeading('\uD83D\uDD14 Basic Package'), 'Basic Package');
  assert.equal(Pay.normalizeHeading('  Foundations  '), 'Foundations');
});

test('normalizeHeading: collapses inner whitespace', () => {
  assert.equal(Pay.normalizeHeading('Couple   Reconnect  - Beginners'), 'Couple Reconnect - Beginners');
});

test('normalizeHeading: handles null/undefined', () => {
  assert.equal(Pay.normalizeHeading(null), '');
  assert.equal(Pay.normalizeHeading(undefined), '');
});

// --- findProductByHeading (collision safety) -------------------------------
test('findProductByHeading: exact match, emoji tolerant', () => {
  assert.equal(Pay.findProductByHeading('\uD83D\uDD14 Basic Package').id, 'program-basic');
  assert.equal(Pay.findProductByHeading('Foundations').id, 'session-foundations');
});

test('findProductByHeading: "Awakening" does not collide with "Spiritual Awakening"', () => {
  assert.equal(Pay.findProductByHeading('Awakening').id, 'session-awakening');
  assert.equal(Pay.findProductByHeading('\uD83D\uDC41\uFE0F Spiritual Awakening').id, 'program-spiritual-awakening');
});

test('findProductByHeading: "Transformation" does not collide with "Deep Healing & Transformation"', () => {
  assert.equal(Pay.findProductByHeading('Transformation').id, 'session-transformation');
  assert.equal(Pay.findProductByHeading('\uD83E\uDD8B Deep Healing & Transformation').id, 'program-deep-healing');
});

test('findProductByHeading: unknown heading returns null', () => {
  assert.equal(Pay.findProductByHeading('Random Heading'), null);
  assert.equal(Pay.findProductByHeading(''), null);
});

// --- validateQuantity ------------------------------------------------------
test('validateQuantity: default min 1 accepts 1', () => {
  const r = Pay.validateQuantity(Pay.getProduct('session-foundations'), 1);
  assert.equal(r.valid, true);
  assert.equal(r.value, 1);
});

test('validateQuantity: sound bath enforces min 5', () => {
  const bath = Pay.getProduct('inperson-sound-bath');
  assert.equal(Pay.validateQuantity(bath, 3).valid, false);
  assert.equal(Pay.validateQuantity(bath, 5).valid, true);
});

test('validateQuantity: rejects zero, negative, and non-integers', () => {
  const p = Pay.getProduct('session-foundations');
  assert.equal(Pay.validateQuantity(p, 0).valid, false);
  assert.equal(Pay.validateQuantity(p, -2).valid, false);
  assert.equal(Pay.validateQuantity(p, 1.5).valid, false);
});

test('validateQuantity: rejects above max', () => {
  const bath = Pay.getProduct('inperson-sound-bath');
  assert.equal(Pay.validateQuantity(bath, 31).valid, false);
  assert.equal(Pay.validateQuantity(bath, 30).valid, true);
});

// --- computeLineItem -------------------------------------------------------
test('computeLineItem: single session subtotal', () => {
  const li = Pay.computeLineItem(Pay.getProduct('session-foundations'), 1);
  assert.equal(li.subtotalMinor, 4500);
  assert.equal(li.display.subtotal, '\u20AC45');
  assert.equal(li.valid, true);
});

test('computeLineItem: sound bath x5 multiplies correctly', () => {
  const li = Pay.computeLineItem(Pay.getProduct('inperson-sound-bath'), 5);
  assert.equal(li.subtotalMinor, 10000);
  assert.equal(li.display.subtotal, '\u20AC100');
});

test('computeLineItem: invalid qty falls back to min and reports error', () => {
  const li = Pay.computeLineItem(Pay.getProduct('inperson-sound-bath'), 2);
  assert.equal(li.valid, false);
  assert.ok(li.error);
  assert.equal(li.quantity, 5);
  assert.equal(li.subtotalMinor, 10000);
});

// --- isValidEmail ----------------------------------------------------------
test('isValidEmail: accepts well-formed, rejects malformed', () => {
  assert.equal(Pay.isValidEmail('seeker@example.com'), true);
  assert.equal(Pay.isValidEmail('nope'), false);
  assert.equal(Pay.isValidEmail('a@b'), false);
  assert.equal(Pay.isValidEmail(''), false);
  assert.equal(Pay.isValidEmail(null), false);
});

// --- buildStripeUrl --------------------------------------------------------
test('buildStripeUrl: always adds client_reference_id', () => {
  const url = Pay.buildStripeUrl('https://buy.stripe.com/abc', { productId: 'session-foundations', quantity: 1 });
  assert.match(url, /client_reference_id=session-foundations_x1_/);
  assert.ok(url.startsWith('https://buy.stripe.com/abc?'));
});

test('buildStripeUrl: prefills a valid email only', () => {
  const withEmail = Pay.buildStripeUrl('https://buy.stripe.com/abc', { productId: 'x', email: 'seeker@example.com' });
  assert.match(withEmail, /prefilled_email=seeker%40example\.com/);
  const badEmail = Pay.buildStripeUrl('https://buy.stripe.com/abc', { productId: 'x', email: 'nope' });
  assert.doesNotMatch(badEmail, /prefilled_email/);
});

test('buildStripeUrl: respects existing query string with &', () => {
  const url = Pay.buildStripeUrl('https://buy.stripe.com/abc?foo=1', { productId: 'x', quantity: 2 });
  assert.match(url, /\?foo=1&client_reference_id=/);
});

// --- buildReservationMailto ------------------------------------------------
test('buildReservationMailto: encodes subject and includes total', () => {
  const m = Pay.buildReservationMailto(Pay.getProduct('session-awakening'), 1);
  assert.ok(m.startsWith('mailto:contact@omsacredspace.com?'));
  assert.match(m, /subject=Booking%20request%3A%20Awakening/);
  assert.match(m, /%E2%82%AC133/);
});

test('buildReservationMailto: variable-qty item includes people count', () => {
  const m = Pay.buildReservationMailto(Pay.getProduct('inperson-sound-bath'), 6);
  assert.match(m, /People%3A%206/);
  assert.match(m, /%E2%82%AC120/);
});

// --- resolveCheckout + modes -----------------------------------------------
test('resolveCheckout: external product routes to its own checkout', () => {
  const r = Pay.resolveCheckout(Pay.getProduct('shop-lotus-tee'), {});
  assert.equal(r.type, 'external');
  assert.equal(r.url, 'https://sacredshop.teemill.com/product/api-69587on1IoCRIWqe6LhiaoRc');
});

test('resolveCheckout: live mode uses the live link when present', () => {
  Pay.setMode('live');
  const r = Pay.resolveCheckout(Pay.getProduct('session-foundations'), { quantity: 1 });
  assert.equal(r.type, 'stripe');
  assert.equal(r.mode, 'live');
  assert.match(r.url, /^https:\/\/buy\.stripe\.com\//);
});

test('resolveCheckout: explicit mode override selects that set', () => {
  const p = Pay.getProduct('session-foundations');
  const test = Pay.resolveCheckout(p, { mode: 'test' });
  const live = Pay.resolveCheckout(p, { mode: 'live' });
  assert.equal(test.type, 'stripe');
  assert.equal(live.type, 'stripe');
  assert.match(test.url, /buy\.stripe\.com\/test_/, 'test mode uses a test link');
  assert.doesNotMatch(live.url, /\/test_/, 'live mode uses a live link');
});

test('resolveCheckout: item with no link in either set falls back to reservation', () => {
  const id = 'program-basic';
  const t = Pay.PAYMENT_LINKS.test[id], l = Pay.PAYMENT_LINKS.live[id];
  Pay.PAYMENT_LINKS.test[id] = ''; Pay.PAYMENT_LINKS.live[id] = '';
  const r = Pay.resolveCheckout(Pay.getProduct(id), { mode: 'test' });
  assert.equal(r.type, 'reserve');
  assert.ok(r.url.startsWith('mailto:'));
  Pay.PAYMENT_LINKS.test[id] = t; Pay.PAYMENT_LINKS.live[id] = l;
});

test('resolveCheckout: null product is unavailable, not a crash', () => {
  const r = Pay.resolveCheckout(null, {});
  assert.equal(r.type, 'unavailable');
  assert.equal(r.url, null);
});

test('setMode / getMode normalize and round-trip', () => {
  assert.equal(Pay.setMode('TEST'), 'test');
  assert.equal(Pay.getMode(), 'test');
  assert.equal(Pay.setMode('anything-else'), 'live');
  assert.equal(Pay.getMode(), 'live');
});

test('linkFor reads from the requested mode set', () => {
  assert.match(Pay.linkFor('session-foundations', 'live'), /buy\.stripe\.com\//);
  assert.match(Pay.linkFor('session-foundations', 'test'), /buy\.stripe\.com\/test_/);
  const id = 'program-basic';
  const t = Pay.PAYMENT_LINKS.test[id];
  Pay.PAYMENT_LINKS.test[id] = '';
  assert.equal(Pay.linkFor(id, 'test'), '');
  Pay.PAYMENT_LINKS.test[id] = t;
});

// --- catalog integrity -----------------------------------------------------
test('catalog: every product has required, well-typed fields', () => {
  Object.keys(Pay.CATALOG).forEach((id) => {
    const p = Pay.CATALOG[id];
    assert.equal(p.id, id, id + ' id matches key');
    assert.equal(typeof p.name, 'string');
    assert.ok(p.name.length > 0, id + ' has a name');
    assert.ok(Number.isInteger(p.priceMinor) && p.priceMinor > 0, id + ' priceMinor is a positive integer');
    assert.ok(['EUR', 'GBP', 'USD'].includes(p.currency), id + ' has a known currency');
    assert.equal(typeof p.heading, 'string');
  });
});

test('catalog: headings are unique after normalization', () => {
  const seen = new Set();
  Object.keys(Pay.CATALOG).forEach((id) => {
    const key = Pay.normalizeHeading(Pay.CATALOG[id].heading).toLowerCase();
    assert.equal(seen.has(key), false, 'duplicate heading: ' + key);
    seen.add(key);
  });
});
