// ============================================
// Om Sacred Space - Checkout: Core (logic layer)
// --------------------------------------------
// Pure, framework-free commerce logic. NO DOM, NO data definitions - it
// imports the catalog and operates on it. Runs in the browser (window.OSSPay)
// and in Node (module.exports) so the logic is unit-tested in isolation.
//
// Dependency: catalog.js  (window.OSSCatalog in the browser; require in Node)
// ============================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./catalog.js'));   // Node / tests
  } else {
    root.OSSPay = factory(root.OSSCatalog);               // Browser
  }
})(typeof self !== 'undefined' ? self : this, function (catalog) {
  'use strict';

  if (!catalog) throw new Error('checkout-core: catalog not found (load catalog.js first)');

  var CONTACT_EMAIL = catalog.CONTACT_EMAIL;
  var CATALOG = catalog.CATALOG;
  var PAYMENT_LINKS = catalog.PAYMENT_LINKS;
  var DEFAULT_MODE = catalog.DEFAULT_MODE || 'live';
  var CURRENCY_SYMBOLS = { EUR: '\u20AC', GBP: '\u00A3', USD: '$' };

  // --- Test / live mode ------------------------------------------------------
  // Decides which link set (PAYMENT_LINKS.test vs .live) the buttons use.
  // Resolution order:
  //   explicit setMode() override (this process)
  //   browser: window.OSS_CHECKOUT_MODE  ->  localStorage('oss-checkout-mode')
  //   node:    process.env.OSS_CHECKOUT_MODE
  //   else:    catalog DEFAULT_MODE
  var _modeOverride = null;

  function normalizeMode(m) { return String(m).toLowerCase() === 'test' ? 'test' : 'live'; }

  function getMode() {
    if (_modeOverride) return _modeOverride;
    try {
      if (typeof window !== 'undefined') {
        if (window.OSS_CHECKOUT_MODE) return normalizeMode(window.OSS_CHECKOUT_MODE);
        var ls = window.localStorage && window.localStorage.getItem('oss-checkout-mode');
        if (ls) return normalizeMode(ls);
      }
      if (typeof process !== 'undefined' && process.env && process.env.OSS_CHECKOUT_MODE) {
        return normalizeMode(process.env.OSS_CHECKOUT_MODE);
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_MODE;
  }

  function setMode(m) {
    var mode = normalizeMode(m);
    _modeOverride = mode;
    if (typeof window !== 'undefined') {
      window.OSS_CHECKOUT_MODE = mode;
      try { window.localStorage.setItem('oss-checkout-mode', mode); } catch (e) { /* ignore */ }
    }
    return mode;
  }

  function linkFor(productId, mode) {
    var set = PAYMENT_LINKS[mode || getMode()] || {};
    return set[productId] || '';
  }

  // --- Money formatting ------------------------------------------------------
  function formatPrice(amountMinor, currency) {
    var symbol = CURRENCY_SYMBOLS[currency] || '';
    var major = amountMinor / 100;
    var str = Number.isInteger(major) ? String(major) : major.toFixed(2);
    return symbol + str;
  }

  // --- Catalog lookup --------------------------------------------------------
  function getProduct(id) {
    return Object.prototype.hasOwnProperty.call(CATALOG, id) ? CATALOG[id] : null;
  }

  function allProducts() {
    return Object.keys(CATALOG).map(function (id) { return CATALOG[id]; });
  }

  // Strip leading emoji/symbols, collapse inner whitespace. Used to match a
  // catalog product to an on-page card heading like "🔔 Basic Package".
  function normalizeHeading(text) {
    if (text == null) return '';
    var s = String(text).replace(/\s+/g, ' ').trim();
    s = s.replace(/^[^0-9A-Za-z\u00C0-\u024F]+/, '');
    return s.trim();
  }

  // Exact (normalized) match avoids collisions like
  // "Awakening" vs "Spiritual Awakening".
  function findProductByHeading(text) {
    var norm = normalizeHeading(text).toLowerCase();
    if (!norm) return null;
    var ids = Object.keys(CATALOG);
    for (var i = 0; i < ids.length; i++) {
      var prod = CATALOG[ids[i]];
      if (normalizeHeading(prod.heading).toLowerCase() === norm) return prod;
    }
    return null;
  }

  // --- Quantity + line item --------------------------------------------------
  function validateQuantity(product, qty) {
    var min = product.minQuantity || 1;
    var max = product.maxQuantity || 99;
    var n = Number(qty);
    if (!Number.isInteger(n)) return { valid: false, error: 'Please enter a whole number.' };
    if (n < 1) return { valid: false, error: 'Quantity must be at least 1.' };
    if (n < min) return { valid: false, error: 'This experience requires at least ' + min + ' people.' };
    if (n > max) return { valid: false, error: 'Maximum ' + max + ' people per booking.' };
    return { valid: true, value: n };
  }

  function computeLineItem(product, qty) {
    var check = validateQuantity(product, qty);
    var quantity = check.valid ? check.value : (product.minQuantity || 1);
    var subtotalMinor = product.priceMinor * quantity;
    return {
      productId: product.id,
      quantity: quantity,
      unitMinor: product.priceMinor,
      subtotalMinor: subtotalMinor,
      currency: product.currency,
      valid: check.valid,
      error: check.valid ? null : check.error,
      display: {
        unit: formatPrice(product.priceMinor, product.currency),
        subtotal: formatPrice(subtotalMinor, product.currency)
      }
    };
  }

  // --- Volume (tiered) pricing ----------------------------------------------
  // Resolve the per-person unit price for a given group size. The whole group
  // bills at the tier matching its size (volume pricing). Falls back to the
  // product's base priceMinor when no tiers are defined.
  function unitMinorForQuantity(product, qty) {
    var tiers = product && product.tiers;
    if (!tiers || !tiers.length) return product ? product.priceMinor : 0;
    var n = Number(qty);
    for (var i = 0; i < tiers.length; i++) {
      if (tiers[i].upTo == null || n <= tiers[i].upTo) return tiers[i].unitMinor;
    }
    return tiers[tiers.length - 1].unitMinor;
  }

  // Like computeLineItem, but applies the tier unit price and reports how much
  // the group saves versus the base (smallest-tier) per-person rate.
  function computeTieredLineItem(product, qty) {
    var check = validateQuantity(product, qty);
    var quantity = check.valid ? check.value : (product.minQuantity || 1);
    var unitMinor = unitMinorForQuantity(product, quantity);
    var subtotalMinor = unitMinor * quantity;
    var baseSubtotalMinor = product.priceMinor * quantity;
    var savingsMinor = Math.max(0, baseSubtotalMinor - subtotalMinor);
    return {
      productId: product.id,
      quantity: quantity,
      unitMinor: unitMinor,
      subtotalMinor: subtotalMinor,
      savingsMinor: savingsMinor,
      currency: product.currency,
      valid: check.valid,
      error: check.valid ? null : check.error,
      display: {
        unit: formatPrice(unitMinor, product.currency),
        subtotal: formatPrice(subtotalMinor, product.currency),
        savings: formatPrice(savingsMinor, product.currency)
      }
    };
  }

  // --- Email + checkout routing ---------------------------------------------
  function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function buildClientReference(product, quantity) {
    return product.id + '_x' + (quantity || 1) + '_' + Date.now();
  }

  function appendParam(url, key, value) {
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + key + '=' + encodeURIComponent(value);
  }

  function buildStripeUrl(base, opts) {
    opts = opts || {};
    var url = base;
    if (opts.email && isValidEmail(opts.email)) {
      url = appendParam(url, 'prefilled_email', opts.email.trim());
    }
    url = appendParam(url, 'client_reference_id',
      buildClientReference({ id: opts.productId || 'item' }, opts.quantity));
    return url;
  }

  function buildReservationMailto(product, quantity, email) {
    var subject = 'Booking request: ' + product.name;
    var lineQty = product.variableQty ? (quantity || product.minQuantity || 1) : 1;
    var line = computeLineItem(product, lineQty);
    var bodyLines = [
      'Hello Suhana,',
      '',
      'I would like to book:',
      '  - ' + product.name + ' (' + product.unit + ')'
    ];
    if (product.variableQty) bodyLines.push('  - People: ' + lineQty);
    bodyLines.push('  - Total: ' + line.display.subtotal + ' ' + product.currency);
    if (isValidEmail(email)) bodyLines.push('', 'My email: ' + email.trim());
    bodyLines.push('', 'Please let me know the next available times. Thank you.');
    return 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(bodyLines.join('\n'));
  }

  // Decide how a product checks out, in priority order:
  //   external  -> product hosts its own checkout (print-on-demand, etc.)
  //   stripe    -> a Payment Link is configured -> one-tap pay
  //   reserve   -> nothing configured yet        -> prefilled email fallback
  function resolveCheckout(product, opts) {
    opts = opts || {};
    if (!product) return { type: 'unavailable', url: null };
    if (product.checkoutUrl) return { type: 'external', url: product.checkoutUrl };

    var link = linkFor(product.id, opts.mode);
    if (link) {
      return {
        type: 'stripe',
        mode: opts.mode || getMode(),
        url: buildStripeUrl(link, { productId: product.id, quantity: opts.quantity, email: opts.email })
      };
    }
    return { type: 'reserve', url: buildReservationMailto(product, opts.quantity, opts.email) };
  }

  return {
    CONTACT_EMAIL: CONTACT_EMAIL,
    CATALOG: CATALOG,
    PAYMENT_LINKS: PAYMENT_LINKS,
    getMode: getMode,
    setMode: setMode,
    linkFor: linkFor,
    formatPrice: formatPrice,
    getProduct: getProduct,
    allProducts: allProducts,
    normalizeHeading: normalizeHeading,
    findProductByHeading: findProductByHeading,
    validateQuantity: validateQuantity,
    computeLineItem: computeLineItem,
    unitMinorForQuantity: unitMinorForQuantity,
    computeTieredLineItem: computeTieredLineItem,
    isValidEmail: isValidEmail,
    buildStripeUrl: buildStripeUrl,
    buildReservationMailto: buildReservationMailto,
    resolveCheckout: resolveCheckout
  };
});
