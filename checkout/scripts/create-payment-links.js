#!/usr/bin/env node
// ============================================
// Om Sacred Space - Stripe Payment Link generator
// --------------------------------------------
// Programmatic, agent-runnable bridge between our catalog and Stripe.
// For each catalog product (that doesn't host its own checkout), it calls the
// Stripe Payment Links API to create a hosted payment page, then patches the
// returned URL back into checkout/catalog.js (PAYMENT_LINKS).
//
// No SDK, no backend: uses Node's built-in fetch + the Stripe REST API.
//
// USAGE
//   STRIPE_SECRET_KEY=sk_test_xxx node checkout/scripts/create-payment-links.js
//   node checkout/scripts/create-payment-links.js --dry-run     (no key, no calls)
//   ... --only session-foundations,program-basic                (subset)
//
// SAFETY
//   - The secret key is read ONLY from the env var and never logged or written.
//   - Use a TEST key (sk_test_...) first. The script warns on a live key.
//   - It only creates new links; it never deletes anything.
//   - Run `git diff checkout/catalog.js` afterwards to review what changed.
// ============================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../catalog.js');

const CATALOG_FILE = path.join(__dirname, '..', 'catalog.js');
const API = 'https://api.stripe.com/v1/payment_links';

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const onlyArg = args.find((a) => a.startsWith('--only'));
const ONLY = onlyArg ? (onlyArg.split('=')[1] || args[args.indexOf(onlyArg) + 1] || '').split(',').filter(Boolean) : null;
const modeArg = args.find((a) => a.startsWith('--mode'));
const MODE_FLAG = modeArg ? (modeArg.split('=')[1] || args[args.indexOf(modeArg) + 1] || '').toLowerCase() : null;

function fail(msg) { console.error('\n✖ ' + msg + '\n'); process.exit(1); }

// Per-mode keys (preferred), with a legacy single-key fallback.
const TEST_KEY = process.env.STRIPE_SECRET_KEY_TEST || '';
const LIVE_KEY = process.env.STRIPE_SECRET_KEY_LIVE || '';
const LEGACY_KEY = process.env.STRIPE_SECRET_KEY || '';

// Resolve mode safely:
//  - explicit --mode wins
//  - else infer if exactly one key is available
//  - if both keys exist and no --mode, refuse (prevents accidental live runs)
let MODE = MODE_FLAG;
if (!MODE && !DRY_RUN) {
  if (TEST_KEY && !LIVE_KEY) MODE = 'test';
  else if (LIVE_KEY && !TEST_KEY) MODE = 'live';
  else if (TEST_KEY && LIVE_KEY) {
    fail('Both test and live keys are set. Choose one explicitly:\n' +
      '  npm run create-links:test     (sandbox, safe)\n' +
      '  npm run create-links:live     (real, payable links)');
  } else if (LEGACY_KEY) {
    MODE = /_test_/.test(LEGACY_KEY) ? 'test' : 'live';
  }
}
if (MODE && MODE !== 'test' && MODE !== 'live') fail('--mode must be "test" or "live".');

function keyForMode(mode) {
  if (mode === 'test') return TEST_KEY || (/_test_/.test(LEGACY_KEY) ? LEGACY_KEY : '');
  if (mode === 'live') return LIVE_KEY || (/_live_/.test(LEGACY_KEY) ? LEGACY_KEY : '');
  return '';
}
const KEY = DRY_RUN ? '' : keyForMode(MODE);

if (!DRY_RUN && !KEY) {
  fail('No ' + MODE + ' key found. Set STRIPE_SECRET_KEY_' + (MODE || 'TEST').toUpperCase() + ' in .env.\n' +
    '  Or preview payloads:  node checkout/scripts/create-payment-links.js --dry-run');
}
// Guard: the key must match the chosen mode.
if (!DRY_RUN && MODE === 'test' && !/_test_/.test(KEY)) fail('Mode is test but the key is not a test key.');
if (!DRY_RUN && MODE === 'live' && !/_live_/.test(KEY)) fail('Mode is live but the key is not a live key.');
if (!DRY_RUN && MODE === 'live') {
  console.warn('⚠  LIVE mode — this creates real, payable links. Ctrl-C to abort.');
}
console.log((DRY_RUN ? '[dry-run] ' : '') + 'Mode: ' + (DRY_RUN ? '(n/a)' : MODE));

// --- which products get a link --------------------------------------------
function targets() {
  return Object.keys(catalog.CATALOG)
    .map((id) => catalog.CATALOG[id])
    .filter((p) => !p.checkoutUrl)                  // external items host their own checkout
    .filter((p) => !ONLY || ONLY.includes(p.id));
}

// --- build the form-encoded body for one product --------------------------
function paramsFor(product) {
  const body = {
    'line_items[0][price_data][currency]': product.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(product.priceMinor),
    'line_items[0][price_data][product_data][name]': product.name,
    'line_items[0][quantity]': String(product.minQuantity || 1),
    // tag the link so checkout.session.completed is easy to reconcile
    'metadata[product_id]': product.id
  };
  if (product.unit) body['line_items[0][price_data][product_data][description]'] = product.unit;
  if (product.variableQty) {
    body['line_items[0][adjustable_quantity][enabled]'] = 'true';
    body['line_items[0][adjustable_quantity][minimum]'] = String(product.minQuantity || 1);
    body['line_items[0][adjustable_quantity][maximum]'] = String(product.maxQuantity || 99);
  }
  return body;
}

async function stripe(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || ('HTTP ' + res.status));
  return json;
}

async function createLink(product) {
  // "Pay what you want" donations: Payment Links can't take an inline custom
  // amount, so mint a Price with custom_unit_amount and reference it by id.
  if (product.customAmount) {
    const price = await stripe('https://api.stripe.com/v1/prices', {
      'currency': product.currency.toLowerCase(),
      'product_data[name]': product.name,
      'custom_unit_amount[enabled]': 'true',
      'custom_unit_amount[minimum]': String(product.customMinMinor || 100),
      ...(product.customPresetMinor ? { 'custom_unit_amount[preset]': String(product.customPresetMinor) } : {})
    });
    const link = await stripe(API, {
      'line_items[0][price]': price.id,
      'line_items[0][quantity]': '1',
      'metadata[product_id]': product.id
    });
    return link.url;
  }
  const link = await stripe(API, paramsFor(product));
  return link.url;
}

// --- patch a single PAYMENT_LINKS entry in catalog.js, scoped to a mode ----
function patchCatalog(productId, url, mode) {
  let src = fs.readFileSync(CATALOG_FILE, 'utf8');
  // Isolate the `<mode>: { ... }` block so we only touch that set's keys.
  const blockRe = new RegExp('(' + mode + '\\s*:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\})');
  const m = src.match(blockRe);
  if (!m) throw new Error('could not find "' + mode + '" link block in catalog.js');

  const idRe = new RegExp("('" + productId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + "'\\s*:\\s*)'[^']*'");
  if (!idRe.test(m[2])) throw new Error('could not find ' + mode + ' entry for ' + productId);
  const patchedBlock = m[2].replace(idRe, "$1'" + url + "'");

  src = src.slice(0, m.index) + m[1] + patchedBlock + m[3] + src.slice(m.index + m[0].length);
  fs.writeFileSync(CATALOG_FILE, src);
}

// --- run -------------------------------------------------------------------
(async function main() {
  const list = targets();
  console.log((DRY_RUN ? '[dry-run] ' : '') + 'Products to process: ' + list.length);

  for (const product of list) {
    if (DRY_RUN) {
      console.log('\n• ' + product.id + '  (' + product.name + ')');
      console.log('  ' + JSON.stringify(paramsFor(product)));
      continue;
    }
    try {
      const url = await createLink(product);
      patchCatalog(product.id, url, MODE);
      console.log('✔ ' + product.id + '  →  ' + url);
    } catch (e) {
      console.error('✖ ' + product.id + '  →  ' + e.message);
    }
  }

  if (!DRY_RUN) {
    console.log('\nDone. Review changes with:  git diff checkout/catalog.js');
  }
})();
