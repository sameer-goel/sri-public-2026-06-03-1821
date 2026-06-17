// ============================================
// Om Sacred Space - Checkout: UI (whole-card link hand-off)
// --------------------------------------------
// Progressive enhancement, browser only. Depends on window.OSSPay
// (checkout-core.js), which depends on window.OSSCatalog (catalog.js).
// Load order:  catalog.js -> checkout-core.js -> checkout-ui.js  (defer)
//
// Philosophy: hassle-free. No separate "Book" button. The entire priced card
// is the click target — clicking it opens that service's Stripe-hosted page
// (with full details) in a new tab. Items without a configured link fall back
// to a prefilled email reservation, so nothing is ever a dead end.
// ============================================
(function () {
  'use strict';

  var Pay = window.OSSPay;
  if (!Pay) return;

  var SELECTORS = '.card, .shop-card';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // Wrap a priced card in an anchor so the whole card is a real link
  // (native keyboard focus, middle-click, open-in-new-tab all work).
  function wireCards() {
    document.querySelectorAll(SELECTORS).forEach(function (card) {
      if (card.tagName === 'A') return;                 // self-linking cards (shop) keep their behavior
      if (card.closest('.oss-card-link')) return;       // already wrapped
      var heading = card.querySelector('h3');
      if (!heading) return;
      var product = Pay.findProductByHeading(heading.textContent);
      if (!product) return;

      var route = Pay.resolveCheckout(product, {});
      if (!route.url) return;

      var a = document.createElement('a');
      a.className = 'oss-card-link';
      a.setAttribute('data-product', product.id);
      a.href = route.url;
      a.setAttribute('aria-label', 'Book ' + product.name + ' \u2014 ' +
        Pay.formatPrice(product.priceMinor, product.currency));
      if (route.type === 'stripe' || route.type === 'external') {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      if (route.type === 'reserve') a.setAttribute('data-reserve', '1');

      card.parentNode.insertBefore(a, card);
      a.appendChild(card);
    });
  }

  // Wire any explicit anchors/buttons the author placed (e.g. the in-person
  // pricing strip, which isn't made of cards):
  //   <a data-oss-product="inperson-sound-bath">Book a sound bath</a>
  function wireExplicit() {
    document.querySelectorAll('[data-oss-product]').forEach(function (el) {
      if (el.dataset.ossWired) return;
      var product = Pay.getProduct(el.getAttribute('data-oss-product'));
      if (!product) return;
      el.dataset.ossWired = '1';
      var route = Pay.resolveCheckout(product, {});
      if (el.tagName === 'A') {
        if (route.url) el.href = route.url;
        if (route.type === 'stripe' || route.type === 'external') { el.target = '_blank'; el.rel = 'noopener'; }
      } else {
        el.setAttribute('role', 'link');
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        var go = function () {
          if (!route.url) return;
          if (route.type === 'reserve') window.location.href = route.url;
          else window.open(route.url, '_blank', 'noopener');
        };
        el.addEventListener('click', go);
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
        });
      }
    });
  }

  // Kept for the standalone gallery preview (checkout.html), which renders its
  // own buttons rather than wrapping cards.
  function makeButton(product) {
    var route = Pay.resolveCheckout(product, {});
    var a = document.createElement('a');
    a.className = 'btn btn--primary btn--sm oss-buy';
    a.setAttribute('data-product', product.id);
    a.textContent = product.priceMinor
      ? 'Book \u00B7 ' + Pay.formatPrice(product.priceMinor, product.currency)
      : 'Book';
    if (route.url) a.href = route.url;
    if (route.type === 'stripe' || route.type === 'external') { a.target = '_blank'; a.rel = 'noopener'; }
    if (route.type === 'reserve') a.setAttribute('data-reserve', '1');
    return a;
  }

  ready(function () {
    wireCards();
    wireExplicit();
  });

  window.OSSCheckout = { makeButton: makeButton, wireCards: wireCards };
})();
