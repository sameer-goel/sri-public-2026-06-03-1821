// ============================================
// Om Sacred Space - Shared Site Behavior
// --------------------------------------------
// Sticky header, mobile menu, scroll reveal, lazy YouTube embeds, and
// Formspree AJAX submission. All behavior is feature-detected, so this single
// file is safe to load on every page regardless of which elements exist.
// Loaded with `defer`. Theme logic lives separately in theme.js.
// ============================================
(function () {
  'use strict';

  // --- Umami analytics (privacy-first, cookieless, no consent banner) ---------
  // Single point of control: because every page loads this shared file, pasting
  // your website ID here turns analytics on everywhere at once (and on any
  // future page that loads site.js). One Umami Cloud account can hold several
  // sites — each gets its own ID, so the same pattern works across websites.
  //
  // To enable: sign up free at https://cloud.umami.is, add this website, copy
  // its "Website ID", and paste it below in place of the placeholder.
  (function loadUmami() {
    var UMAMI_WEBSITE_ID = 'bb273cc4-82d8-405b-99b2-dae7ab6b6840'; // Om Sacred Space (Umami Cloud)
    var UMAMI_SRC = 'https://cloud.umami.is/script.js';

    // Stay dormant until configured, so this is safe to commit/deploy as-is.
    if (!UMAMI_WEBSITE_ID || UMAMI_WEBSITE_ID === 'YOUR-UMAMI-WEBSITE-ID') return;
    // Don't record local/dev traffic.
    var host = location.hostname;
    if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '') return;
    // Avoid double-loading.
    if (document.querySelector('script[data-website-id="' + UMAMI_WEBSITE_ID + '"]')) return;

    var s = document.createElement('script');
    s.async = true;
    s.defer = true;
    s.src = UMAMI_SRC;
    s.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
    document.head.appendChild(s);
  })();

  // --- Umami custom events ----------------------------------------------------
  // Fire-and-forget tracker: a no-op until the Umami script has loaded, and it
  // never throws (analytics must never break the page).
  function ossTrack(eventName, data) {
    try {
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(eventName, data);
      }
    } catch (e) { /* ignore */ }
  }

  // Inspect a clicked node and, if it sits inside a Book/Pay control, describe
  // the Umami event to send. Pure and dependency-injected (getProduct) so it
  // unit-tests without a page-wide setup. Returns null when the click was not
  // on a checkout control.
  //   - .oss-card-link / .oss-buy carry data-product
  //   - author-placed controls carry data-oss-product
  //   - data-reserve="1" marks the email-reservation fallback (vs. a paid link)
  function describeCheckoutClick(target, getProduct) {
    if (!target || typeof target.closest !== 'function') return null;
    var el = target.closest('[data-product], [data-oss-product]');
    if (!el) return null;
    var id = el.getAttribute('data-product') || el.getAttribute('data-oss-product');
    if (!id) return null;

    var data = {
      product: id,
      action: el.getAttribute('data-reserve') === '1' ? 'reserve' : 'pay'
    };
    // Enrich with name/price when the catalog (window.OSSPay) is available.
    var product = typeof getProduct === 'function' ? getProduct(id) : null;
    if (product) {
      if (product.name) data.name = product.name;
      if (product.currency) data.currency = product.currency;
      if (product.priceMinor != null) data.price = Math.round(product.priceMinor) / 100;
    }
    return { event: 'checkout_click', data: data };
  }

  // Exposed for tests and optional manual tracking.
  window.OSSAnalytics = { track: ossTrack, describeCheckoutClick: describeCheckoutClick };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    // --- Sticky header (only on pages whose header starts transparent, i.e.
    //     index + sound-healing. Coming-soon pages bake in `header--scrolled`
    //     and have no scroll behavior, so they're skipped) ---
    var header = document.getElementById('header');
    if (header && !header.classList.contains('header--scrolled')) {
      var lastY = 0;
      window.addEventListener('scroll', function () {
        header.classList.toggle('header--scrolled', window.scrollY > 50);
        header.classList.toggle('header--hidden', window.scrollY > lastY && window.scrollY > 400);
        lastY = window.scrollY;
      }, { passive: true });
    }

    // --- Mobile menu ---
    var burger = document.getElementById('burger');
    var navLinks = document.getElementById('navLinks');
    if (burger && navLinks) {
      var closeMenu = function () {
        navLinks.classList.remove('nav__links--open');
        burger.classList.remove('burger--open');
        document.body.classList.remove('no-scroll');
      };
      burger.addEventListener('click', function () {
        navLinks.classList.toggle('nav__links--open');
        burger.classList.toggle('burger--open');
        document.body.classList.toggle('no-scroll');
      });
      navLinks.querySelectorAll('.nav__link').forEach(function (l) {
        l.addEventListener('click', closeMenu);
      });
    }

    // --- Scroll reveal ---
    var reveals = document.querySelectorAll('.reveal');
    if (reveals.length) {
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); }
          });
        }, { threshold: 0.15 });
        reveals.forEach(function (el) { observer.observe(el); });
      } else {
        reveals.forEach(function (el) { el.classList.add('revealed'); });
      }
    }

    // --- Lazy YouTube embeds (click/keyboard to load) ---
    document.querySelectorAll('.yt-thumb[data-video-id]').forEach(function (thumb) {
      var load = function () {
        var id = thumb.getAttribute('data-video-id');
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.allowFullscreen = true;
        iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:16px';
        thumb.innerHTML = '';
        thumb.appendChild(iframe);
        thumb.style.cursor = 'default';
      };
      thumb.addEventListener('click', load);
      thumb.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); load(); }
      });
    });

    // --- Formspree AJAX submission (contact form + signup form) ---
    document.querySelectorAll('form[action*="formspree.io"]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"], button');
        var original = btn ? btn.textContent : '';
        if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

        fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' }
        }).then(function (r) {
          if (r.ok) {
            // Contact form pattern: swap fields block for success block.
            var fields = form.querySelector('.form__fields');
            var success = form.querySelector('.form__success');
            // Signup form pattern: hide the row, show inline success.
            var row = form.querySelector('.signup__row');
            var signupSuccess = form.querySelector('.signup__success');
            if (fields && success) {
              fields.style.display = 'none';
              success.style.display = 'flex';
            } else if (row && signupSuccess) {
              row.style.display = 'none';
              signupSuccess.style.display = 'block';
            }
            form.reset();
          } else {
            if (btn) { btn.textContent = 'Error - try again'; btn.disabled = false; }
          }
        }).catch(function () {
          if (btn) { btn.textContent = 'Error - try again'; btn.disabled = false; }
        });
      });
    });

    // --- Checkout interest tracking (Umami custom event) ---------------------
    // One delegated, capture-phase listener covers every Book/Pay control on
    // the page (wrapped cards, buy buttons, explicit [data-oss-product]).
    // Capture phase ensures it runs even though most controls open Stripe in a
    // new tab. The catalog (window.OSSPay) loads on commerce pages only, so
    // enrichment is best-effort.
    document.addEventListener('click', function (e) {
      var getProduct = (window.OSSPay && window.OSSPay.getProduct) || null;
      var hit = describeCheckoutClick(e.target, getProduct);
      if (hit) ossTrack(hit.event, hit.data);
    }, true);
  });
})();
