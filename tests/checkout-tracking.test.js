// ============================================
// Om Sacred Space - Event tracking tests (jsdom)
// Run with:  npm test   (or)  npm run test:ui
//
// Verifies the Umami custom events wired in site.js:
//   1. describeCheckoutClick() - the pure detection/description helper.
//   2. The delegated, capture-phase click listener that sends checkout_click.
//   3. Catalog enrichment (name/price) when window.OSSPay is present.
//   4. describeFormSubmit() + a successful Formspree submit sending "signup".
//   5. Safety: analytics is a no-op (never throws) before Umami loads.
// ============================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const siteSrc = fs.readFileSync(path.join(root, 'site.js'), 'utf8');

// jsdom harness. URL is localhost so site.js's Umami loader stays dormant
// (it skips local hosts); we inject our own window.umami stub to capture events.
function setupPage(bodyHtml, opts) {
  opts = opts || {};
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>${bodyHtml || ''}</body></html>`,
    { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true }
  );
  const w = dom.window;

  // Optional catalog stub (the real one is window.OSSPay from checkout-core.js).
  if (opts.products) {
    w.OSSPay = { getProduct: function (id) { return opts.products[id] || null; } };
  }

  // Capture Umami events unless the test asks for the "not loaded yet" case.
  w.umamiCalls = [];
  if (opts.withUmami !== false) {
    w.umami = { track: function (event, data) { w.umamiCalls.push({ event: event, data: data }); } };
  }

  // Stub fetch for the Formspree submit handler (jsdom has none by default).
  w.fetch = function () { return Promise.resolve({ ok: opts.fetchOk !== false }); };

  w.eval(siteSrc);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return w;
}

function click(w, el) {
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
}

// Submit a form and let the stubbed-fetch promise chain settle.
async function submit(w, form) {
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
}

// site.js runs inside the jsdom realm, so objects it creates carry jsdom's
// Object.prototype. Normalize to a plain Node object before structural compare.
function plain(o) {
  return JSON.parse(JSON.stringify(o));
}

// ============================================================
// 1. describeCheckoutClick - pure detection/description
// ============================================================
test('describeCheckoutClick: ignores clicks outside any checkout control', () => {
  const w = setupPage('<div><p id="p">just text</p></div>');
  const desc = w.OSSAnalytics.describeCheckoutClick(w.document.getElementById('p'), null);
  assert.equal(desc, null);
});

test('describeCheckoutClick: a wrapped card reports a pay action', () => {
  const w = setupPage('<a class="oss-card-link" data-product="program-basic"><div class="card"><h3>Basic</h3></div></a>');
  const desc = w.OSSAnalytics.describeCheckoutClick(w.document.querySelector('h3'), null);
  assert.deepEqual(plain(desc), { event: 'checkout_click', data: { product: 'program-basic', action: 'pay' } });
});

test('describeCheckoutClick: data-reserve marks the email-reservation fallback', () => {
  const w = setupPage('<a class="oss-card-link" data-product="custom-package" data-reserve="1"><h3>Custom</h3></a>');
  const desc = w.OSSAnalytics.describeCheckoutClick(w.document.querySelector('h3'), null);
  assert.equal(desc.data.action, 'reserve');
});

test('describeCheckoutClick: supports author-placed [data-oss-product] controls', () => {
  const w = setupPage('<a data-oss-product="inperson-sound-bath">Book a sound bath</a>');
  const desc = w.OSSAnalytics.describeCheckoutClick(w.document.querySelector('a'), null);
  assert.deepEqual(plain(desc.data), { product: 'inperson-sound-bath', action: 'pay' });
});

test('describeCheckoutClick: walks up from an inner child to the control', () => {
  const w = setupPage('<a class="oss-card-link" data-product="p1"><div class="card"><h3><span id="deep">Deep</span></h3></div></a>');
  const desc = w.OSSAnalytics.describeCheckoutClick(w.document.getElementById('deep'), null);
  assert.equal(desc.data.product, 'p1');
});

test('describeCheckoutClick: enriches with name/price/currency from the catalog', () => {
  const products = { p1: { id: 'p1', name: 'Sound Bath', priceMinor: 4500, currency: 'EUR' } };
  const w = setupPage('<a class="oss-card-link" data-product="p1"><h3>x</h3></a>', { products });
  const desc = w.OSSAnalytics.describeCheckoutClick(w.document.querySelector('h3'), w.OSSPay.getProduct);
  assert.deepEqual(plain(desc.data), { product: 'p1', action: 'pay', name: 'Sound Bath', currency: 'EUR', price: 45 });
});

// ============================================================
// 2. Delegated listener - end-to-end click -> Umami event
// ============================================================
test('clicking a Book/Pay control sends exactly one checkout_click event', () => {
  const w = setupPage('<a class="oss-card-link" data-product="program-basic"><div class="card"><h3>Basic</h3></div></a>');
  click(w, w.document.querySelector('h3'));

  assert.equal(w.umamiCalls.length, 1);
  assert.equal(w.umamiCalls[0].event, 'checkout_click');
  assert.equal(w.umamiCalls[0].data.product, 'program-basic');
  assert.equal(w.umamiCalls[0].data.action, 'pay');
});

test('clicking outside any checkout control sends no event', () => {
  const w = setupPage('<button id="b">Just a button</button>');
  click(w, w.document.getElementById('b'));
  assert.equal(w.umamiCalls.length, 0);
});

test('the sent event is enriched from the catalog when window.OSSPay is present', () => {
  const products = { p1: { id: 'p1', name: 'Group Sound Bath', priceMinor: 2500, currency: 'EUR' } };
  const w = setupPage('<a class="oss-card-link" data-product="p1"><h3>x</h3></a>', { products });
  click(w, w.document.querySelector('h3'));

  assert.equal(w.umamiCalls.length, 1);
  assert.deepEqual(plain(w.umamiCalls[0].data), {
    product: 'p1', action: 'pay', name: 'Group Sound Bath', currency: 'EUR', price: 25
  });
});

// ============================================================
// 3. Safety - analytics must never break the page
// ============================================================
test('a checkout click never throws when Umami has not loaded yet', () => {
  const w = setupPage('<a class="oss-card-link" data-product="p1"><h3>x</h3></a>', { withUmami: false });
  const h3 = w.document.querySelector('h3');
  assert.doesNotThrow(function () { click(w, h3); });
});

// ============================================================
// 4. describeFormSubmit - newsletter vs contact classification
// ============================================================
test('describeFormSubmit: a newsletter form is classified as "newsletter"', () => {
  const w = setupPage('<form action="https://formspree.io/f/x"><div class="signup__row"></div><div class="signup__success"></div></form>');
  const desc = w.OSSAnalytics.describeFormSubmit(w.document.querySelector('form'));
  assert.deepEqual(plain(desc), { event: 'signup', data: { form: 'newsletter' } });
});

test('describeFormSubmit: a contact form is classified as "contact"', () => {
  const w = setupPage('<form action="https://formspree.io/f/x"><div class="form__fields"></div><div class="form__success"></div></form>');
  const desc = w.OSSAnalytics.describeFormSubmit(w.document.querySelector('form'));
  assert.deepEqual(plain(desc), { event: 'signup', data: { form: 'contact' } });
});

test('describeFormSubmit: an unrecognized form falls back to "form"', () => {
  const w = setupPage('<form action="https://formspree.io/f/x"><input name="email"></form>');
  const desc = w.OSSAnalytics.describeFormSubmit(w.document.querySelector('form'));
  assert.equal(desc.data.form, 'form');
});

test('describeFormSubmit: null/invalid input returns null', () => {
  const w = setupPage('');
  assert.equal(w.OSSAnalytics.describeFormSubmit(null), null);
});

// ============================================================
// 5. End-to-end - a successful submit sends one signup event
// ============================================================
test('submitting the newsletter form sends a signup event (form: newsletter)', async () => {
  const w = setupPage('<form action="https://formspree.io/f/x"><div class="signup__row"><input name="email"><button type="submit">Join</button></div><div class="signup__success" style="display:none"></div></form>');
  await submit(w, w.document.querySelector('form'));

  assert.equal(w.umamiCalls.length, 1);
  assert.equal(w.umamiCalls[0].event, 'signup');
  assert.equal(w.umamiCalls[0].data.form, 'newsletter');
});

test('submitting the contact form sends a signup event (form: contact)', async () => {
  const w = setupPage('<form action="https://formspree.io/f/x"><div class="form__fields"><input name="email"><button type="submit">Send</button></div><div class="form__success" style="display:none"></div></form>');
  await submit(w, w.document.querySelector('form'));

  assert.equal(w.umamiCalls.length, 1);
  assert.equal(w.umamiCalls[0].event, 'signup');
  assert.equal(w.umamiCalls[0].data.form, 'contact');
});

test('a failed submission sends no signup event', async () => {
  const w = setupPage('<form action="https://formspree.io/f/x"><div class="signup__row"><input name="email"><button type="submit">Join</button></div><div class="signup__success" style="display:none"></div></form>', { fetchOk: false });
  await submit(w, w.document.querySelector('form'));
  assert.equal(w.umamiCalls.length, 0);
});
