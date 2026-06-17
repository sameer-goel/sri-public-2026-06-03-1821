// ============================================
// Om Sacred Space - Checkout UI integration tests (jsdom)
// Run with:  npm test
// Loads the module (catalog -> core -> ui) into jsdom and verifies the
// whole-card link hand-off: each priced card is wrapped in an anchor pointing
// at the right checkout (Stripe link, external store, or email reservation).
// ============================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const dir = path.join(__dirname, '..');
const catalogSrc = fs.readFileSync(path.join(dir, 'catalog.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(dir, 'checkout-core.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(dir, 'checkout-ui.js'), 'utf8');

function setup(prep) {
  const html = `<!DOCTYPE html><html><body>
    <div class="cards">
      <div class="card"><div class="card__body"><h3>Foundations</h3></div></div>
      <div class="card"><div class="card__body"><h3>🔔 Basic Package</h3></div></div>
    </div>
    <a class="explicit" data-oss-product="inperson-sound-bath">Book a sound bath</a>
  </body></html>`;
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.eval(catalogSrc);
  w.eval(coreSrc);
  w.eval(uiSrc);
  if (typeof prep === 'function') prep(w);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return w;
}

test('module loads cleanly across the three layers', () => {
  const w = setup();
  assert.equal(typeof w.OSSCatalog, 'object');
  assert.equal(typeof w.OSSPay, 'object');
  assert.equal(typeof w.OSSCheckout, 'object');
});

test('wraps a priced card in a checkout link (no separate button)', () => {
  const w = setup();
  const link = w.document.querySelector('.oss-card-link[data-product="session-foundations"]');
  assert.ok(link, 'card wrapped in an oss-card-link anchor');
  assert.equal(link.tagName, 'A');
  assert.ok(link.querySelector('.card'), 'the card lives inside the link');
  // no injected Book button anymore
  assert.equal(w.document.querySelector('.card .oss-buy'), null);
});

test('configured product points the whole card at Stripe in a new tab', () => {
  const w = setup();
  const link = w.document.querySelector('.oss-card-link[data-product="session-foundations"]');
  assert.match(link.href, /^https:\/\/buy\.stripe\.com\//);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener');
  assert.ok(link.getAttribute('aria-label').indexOf('Foundations') !== -1);
});

test('unconfigured product falls back to an email reservation', () => {
  const w = setup((win) => {
    win.OSSPay.PAYMENT_LINKS.test['program-basic'] = '';
    win.OSSPay.PAYMENT_LINKS.live['program-basic'] = '';
  });
  const link = w.document.querySelector('.oss-card-link[data-product="program-basic"]');
  assert.ok(link, 'Basic Package card wrapped');
  assert.match(link.getAttribute('href'), /^mailto:/);
  assert.equal(link.getAttribute('data-reserve'), '1');
  assert.notEqual(link.target, '_blank');
});

test('explicit [data-oss-product] anchor gets wired (in-person sound bath)', () => {
  const w = setup();
  const a = w.document.querySelector('a.explicit');
  assert.equal(a.dataset.ossWired, '1');
  assert.ok(a.getAttribute('href'), 'href was set');
});
